const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

// 确保数据目录存在
function ensureDataDir() {
  const dataDir = path.dirname(config.outputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 生成文件的唯一 ID
function generateId(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

// 检查文件扩展名是否匹配
function hasExtension(file, extensions) {
  const ext = path.extname(file).toLowerCase();
  return extensions.includes(ext);
}

// 从文件名中提取标题（去掉扩展名）
// 如果目录下只有一个视频，用目录名；如果有多个视频，用文件名
function getTitleFromPath(filePath, videoCountInDir) {
  const dirName = path.basename(path.dirname(filePath));
  const fileName = path.basename(filePath, path.extname(filePath));

  // 如果目录下只有一个视频，使用目录名；否则使用文件名
  if (videoCountInDir === 1 && dirName && dirName !== '.' && dirName !== '..') {
    return dirName;
  }
  return fileName;
}

// 规范化路径分隔符
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

// 检查是否是系统目录（应该跳过）
function isSystemDirectory(dirName) {
  const systemDirs = [
    '$RECYCLE.BIN',
    'System Volume Information',
    '$RECYCLE',
    '.Trash',
    '.Trashes',
    'RECYCLER',
    'Config.Msi',
    'Program Files',
    'Program Files (x86)',
    'Windows',
    'ProgramData',
    'Documents and Settings',
    '$WinREAgent',
    '$SysReset',
  ];
  return systemDirs.includes(dirName);
}

// 目录缓存信息
class DirCache {
  constructor() {
    this.dirInfo = new Map(); // path -> { files, stat, posterPath }
  }

  getDirInfo(dirPath) {
    const normalized = normalizePath(dirPath);
    let info = this.dirInfo.get(normalized);
    if (!info) {
      info = this._readDir(dirPath);
      this.dirInfo.set(normalized, info);
    }
    return info;
  }

  _readDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return { files: [], hasPoster: false, posterPath: null };
    }

    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch (err) {
      console.warn(`无法读取目录: ${dirPath}`, err.message);
      return { files: [], hasPoster: false, posterPath: null };
    }

    // 查找海报
    const posterFiles = files.filter(f => hasExtension(f, config.posterExtensions));
    let posterPath = null;

    if (posterFiles.length > 0) {
      // 先找通用名称（保留这个逻辑用于目录海报）
      for (const posterName of config.posterNames) {
        for (const file of posterFiles) {
          const nameWithoutExt = path.basename(file, path.extname(file)).toLowerCase();
          if (nameWithoutExt === posterName) {
            posterPath = path.join(dirPath, file);
            break;
          }
        }
        if (posterPath) break;
      }
      // 如果没找到优先名称，用第一个
      if (!posterPath) {
        posterPath = path.join(dirPath, posterFiles[0]);
      }
    }

    return {
      files,
      posterFiles, // 保存图片文件列表，给后面视频匹配同名图片用
      hasPoster: posterFiles.length > 0,
      posterPath
    };
  }
}

// 性能计时器
class PerfTimer {
  constructor() {
    this.startTime = Date.now();
    this.lastTime = this.startTime;
    this.metrics = new Map();
  }

  step(label) {
    const now = Date.now();
    const elapsed = now - this.lastTime;
    const totalElapsed = now - this.startTime;
    this.lastTime = now;

    const current = this.metrics.get(label) || { count: 0, total: 0 };
    current.count++;
    current.total += elapsed;
    this.metrics.set(label, current);

    return { elapsed, totalElapsed };
  }

  report() {
    console.log('\n=== 性能报告 ===');
    for (const [label, data] of this.metrics) {
      console.log(`  ${label}: ${data.count}次, 总计${data.total}ms, 平均${(data.total / data.count).toFixed(1)}ms`);
    }
    console.log(`  总计: ${Date.now() - this.startTime}ms`);
    console.log('================\n');
  }
}

let globalPerf = null;
let dirScanCount = 0;
let videoProcessCount = 0;

// 单次遍历收集所有信息
function scanDirectoryRecursive(dirPath, hardDrive, dirCache, results) {
  const dirName = path.basename(dirPath);
  if (isSystemDirectory(dirName)) {
    return null;
  }

  dirScanCount++;
  if (dirScanCount % 100 === 0) {
    const perf = globalPerf.step('scan_100_dirs');
    console.log(`  已扫描 ${dirScanCount} 个目录, ${videoProcessCount} 个视频 (+${perf.elapsed}ms)`);
  }

  const dirInfo = dirCache.getDirInfo(dirPath);
  if (!dirInfo.files) {
    return null;
  }

  const normalizedDirPath = normalizePath(dirPath);

  // 收集当前目录的视频
  const videoFiles = dirInfo.files.filter(f => hasExtension(f, config.videoExtensions));
  const videoCountInDir = videoFiles.length;

  for (const videoFile of videoFiles) {
    const videoPath = path.join(dirPath, videoFile);
    let videoStat;
    try {
      videoStat = fs.statSync(videoPath);
    } catch (err) {
      console.warn(`无法读取文件: ${videoPath}`, err.message);
      continue;
    }

    if (videoStat.size < config.minVideoSize) {
      continue;
    }

    // 查找雪碧图（扫描时不自动生成 VTT，避免卡顿）
    const baseName = path.basename(videoFile, path.extname(videoFile));
    const expectedSpriteName = `${baseName}_sprite.jpg`;
    const expectedSpritePath = path.join(dirPath, expectedSpriteName);
    const spritePath = fs.existsSync(expectedSpritePath) ? expectedSpritePath : null;

    let spriteVttPath = null;
    if (spritePath) {
      const expectedVttName = `${baseName}_sprite.vtt`;
      const expectedVttPath = path.join(dirPath, expectedVttName);
      if (fs.existsSync(expectedVttPath)) {
        spriteVttPath = expectedVttPath;
      }
      // 注意：扫描时不自动生成 VTT，需要时在前端或单独生成
    }

    // 查找海报 - 优先找与视频同名的图片
    let videoPosterPath = null;
    if (dirInfo.posterFiles && dirInfo.posterFiles.length > 0) {
      // 1. 先找与视频同名的图片
      for (const file of dirInfo.posterFiles) {
        const nameWithoutExt = path.basename(file, path.extname(file));
        if (nameWithoutExt.toLowerCase() === baseName.toLowerCase()) {
          videoPosterPath = path.join(dirPath, file);
          break;
        }
      }
      // 2. 如果没找到，再找通用名称
      if (!videoPosterPath) {
        for (const posterName of config.posterNames) {
          for (const file of dirInfo.posterFiles) {
            const nameWithoutExt = path.basename(file, path.extname(file)).toLowerCase();
            if (nameWithoutExt === posterName) {
              videoPosterPath = path.join(dirPath, file);
              break;
            }
          }
          if (videoPosterPath) break;
        }
      }
      // 3. 最后，如果没找到通用名称，用第一张图（但要排除雪碧图）
      if (!videoPosterPath) {
        for (const file of dirInfo.posterFiles) {
          // 排除雪碧图
          if (!file.toLowerCase().endsWith('_sprite.jpg') &&
              !file.toLowerCase().endsWith('_sprite.jpeg') &&
              !file.toLowerCase().endsWith('_sprite.png')) {
            videoPosterPath = path.join(dirPath, file);
            break;
          }
        }
      }
    }

    const video = {
      id: generateId(videoPath),
      title: getTitleFromPath(videoPath, videoCountInDir),
      directory: normalizedDirPath,
      hardDrive: hardDrive,
      videoPath: normalizePath(videoPath),
      posterPath: videoPosterPath ? normalizePath(videoPosterPath) : undefined,
      spritePath: spritePath ? normalizePath(spritePath) : undefined,
      spriteVttPath: spriteVttPath ? normalizePath(spriteVttPath) : undefined,
      videoExtension: path.extname(videoFile).toLowerCase(),
      posterExtension: videoPosterPath ? path.extname(videoPosterPath) : undefined,
      fileSize: videoStat.size,
      createdAt: videoStat.birthtimeMs,
      updatedAt: videoStat.mtimeMs,
    };

    results.videos.push(video);
    videoProcessCount++;

    if (!results.directories.includes(normalizedDirPath)) {
      results.directories.push(normalizedDirPath);
    }
  }

  // 构建目录树节点
  const treeNode = {
    name: dirName || hardDrive,
    path: normalizedDirPath,
    parentPath: '',
    children: [],
    videoCount: videoCountInDir > 0 ? 1 : 0,
  };

  // 递归处理子目录
  for (const file of dirInfo.files) {
    const fullPath = path.join(dirPath, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      continue;
    }

    if (stat.isDirectory() && config.recursive && !isSystemDirectory(file)) {
      const childCache = dirCache.getDirInfo(fullPath);
      const childNode = scanDirectoryRecursive(fullPath, hardDrive, dirCache, results);
      if (childNode) {
        childNode.parentPath = normalizedDirPath;
        // 只保留有内容的子目录
        const childHasVideos = childNode.videoCount > 0;
        const childHasPoster = childCache.hasPoster;
        const childHasChildren = childNode.children.length > 0;
        if (childHasVideos || childHasPoster || childHasChildren) {
          treeNode.children.push(childNode);
          treeNode.videoCount += childNode.videoCount;
        }
      }
    }
  }

  // 按名称排序子目录
  treeNode.children.sort((a, b) => a.name.localeCompare(b.name));

  return treeNode;
}

// 主扫描函数
function scan() {
  globalPerf = new PerfTimer();
  dirScanCount = 0;
  videoProcessCount = 0;

  console.log('\n========================================');
  console.log('开始扫描...');
  console.log('开始时间:', new Date().toLocaleString());
  console.log('配置的硬盘:', config.hardDrives);
  console.log('========================================\n');

  ensureDataDir();
  globalPerf.step('ensureDataDir');

  const results = {
    version: '2.0.0',
    generatedAt: Date.now(),
    hardDrives: config.hardDrives.filter(hd => fs.existsSync(hd)),
    directories: [],
    directoryTree: [],
    videos: [],
  };

  const dirCache = new DirCache();
  globalPerf.step('init_data_structures');

  for (const hardDrive of config.hardDrives) {
    if (!fs.existsSync(hardDrive)) {
      console.warn(`硬盘不存在或未挂载: ${hardDrive}`);
      continue;
    }
    console.log(`\n---------- 扫描硬盘: ${hardDrive} ----------`);
    const driveStart = Date.now();

    const tree = scanDirectoryRecursive(hardDrive, hardDrive, dirCache, results);
    const rootCache = dirCache.getDirInfo(hardDrive);
    if (tree && (tree.videoCount > 0 || rootCache.hasPoster || tree.children.length > 0)) {
      results.directoryTree.push(tree);
    }

    console.log(`  硬盘 ${hardDrive} 扫描完成, 耗时 ${Date.now() - driveStart}ms`);
    globalPerf.step(`scan_drive_${hardDrive}`);
  }

  console.log('\n---------- 排序视频 ----------');
  const sortStart = Date.now();
  results.videos.sort((a, b) => {
    if (a.directory !== b.directory) {
      return a.directory.localeCompare(b.directory);
    }
    return a.title.localeCompare(b.title);
  });
  console.log(`  排序完成, 耗时 ${Date.now() - sortStart}ms`);
  globalPerf.step('sort_videos');

  console.log('\n---------- 写入文件 ----------');
  const writeStart = Date.now();
  console.log(`  写入路径: ${config.outputPath}`);
  const jsonString = JSON.stringify(results);
  console.log(`  数据大小: ~${(jsonString.length / 1024 / 1024).toFixed(2)}MB`);
  fs.writeFileSync(config.outputPath, jsonString, 'utf-8');
  console.log(`  写入完成, 耗时 ${Date.now() - writeStart}ms`);
  globalPerf.step('write_file');

  console.log('\n========================================');
  console.log(`扫描完成!`);
  console.log(`结束时间: ${new Date().toLocaleString()}`);
  console.log(`- 找到 ${results.videos.length} 个视频`);
  console.log(`- 扫描 ${dirScanCount} 个目录`);
  console.log(`- 涉及 ${results.directories.length} 个有视频的目录`);
  console.log(`- 目录缓存: ${dirCache.dirInfo.size} 个目录`);
  console.log(`- 数据已保存到: ${config.outputPath}`);
  globalPerf.report();

  return results;
}

if (require.main === module) {
  try {
    scan();
  } catch (err) {
    console.error('扫描出错:', err);
    process.exit(1);
  }
}

module.exports = { scan };
