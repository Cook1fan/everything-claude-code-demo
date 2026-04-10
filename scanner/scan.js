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

// 查找目录下的海报图片
function findPosterInDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const files = fs.readdirSync(dirPath);
  const posterFiles = files.filter(f => hasExtension(f, config.posterExtensions));

  for (const posterName of config.posterNames) {
    for (const file of posterFiles) {
      const nameWithoutExt = path.basename(file, path.extname(file)).toLowerCase();
      if (nameWithoutExt === posterName) {
        return path.join(dirPath, file);
      }
    }
  }

  if (posterFiles.length > 0) {
    return path.join(dirPath, posterFiles[0]);
  }

  return null;
}

// 查找目录下的雪碧图文件
function findSpriteInDir(dirPath, videoFileName) {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const baseName = path.basename(videoFileName, path.extname(videoFileName));
  const expectedSpriteName = `${baseName}_sprite.jpg`;
  const expectedSpritePath = path.join(dirPath, expectedSpriteName);

  if (fs.existsSync(expectedSpritePath)) {
    return expectedSpritePath;
  }

  return null;
}

// 检查目录是否有主图
function hasPosterInDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    console.warn(`无法读取目录: ${dirPath}`, err.message);
    return false;
  }

  const posterFiles = files.filter(f => hasExtension(f, config.posterExtensions));
  return posterFiles.length > 0;
}

// 构建目录树
function buildDirectoryTree(dirPath, hardDrive, parentPath = '') {
  const treeNode = {
    name: path.basename(dirPath) || hardDrive,
    path: normalizePath(dirPath),
    parentPath: parentPath,
    children: [],
    videoCount: 0,
  };

  if (!fs.existsSync(dirPath)) {
    return treeNode;
  }

  // 跳过系统目录
  const dirName = path.basename(dirPath);
  if (isSystemDirectory(dirName)) {
    return treeNode;
  }

  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    console.warn(`无法读取目录: ${dirPath}`, err.message);
    return treeNode;
  }

  // 检查当前目录是否有视频
  const hasVideos = files.some(f => hasExtension(f, config.videoExtensions));
  if (hasVideos) {
    treeNode.videoCount = 1;
  }

  // 检查当前目录是否有主图
  const hasPoster = hasPosterInDir(dirPath);

  // 递归处理子目录
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      continue;
    }

    if (stat.isDirectory() && config.recursive && !isSystemDirectory(file)) {
      const childNode = buildDirectoryTree(fullPath, hardDrive, normalizePath(dirPath));
      // 只保留有内容的子目录（有视频、有主图、或有子目录）
      if (childNode.videoCount > 0 || hasPosterInDir(fullPath) || childNode.children.length > 0) {
        treeNode.children.push(childNode);
        treeNode.videoCount += childNode.videoCount;
      }
    }
  }

  // 按名称排序子目录
  treeNode.children.sort((a, b) => a.name.localeCompare(b.name));

  return treeNode;
}

// 统计目录下的视频数量
function countVideosInDirectory(dirPath, videoCountMap) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  // 跳过系统目录
  const dirName = path.basename(dirPath);
  if (isSystemDirectory(dirName)) {
    return;
  }

  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    return;
  }

  const videoFiles = files.filter(f => hasExtension(f, config.videoExtensions));
  const normalizedDirPath = normalizePath(dirPath);
  videoCountMap[normalizedDirPath] = (videoCountMap[normalizedDirPath] || 0) + videoFiles.length;

  if (config.recursive) {
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        continue;
      }
      if (stat.isDirectory() && !isSystemDirectory(file)) {
        countVideosInDirectory(fullPath, videoCountMap);
      }
    }
  }
}

// 扫描单个目录，收集视频
function scanDirectory(dirPath, hardDrive, results, videoCountMap) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`目录不存在: ${dirPath}`);
    return;
  }

  // 跳过系统目录
  const dirName = path.basename(dirPath);
  if (isSystemDirectory(dirName)) {
    return;
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    return;
  }

  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    console.warn(`无法读取目录: ${dirPath}`, err.message);
    return;
  }

  const videoFiles = files.filter(f => hasExtension(f, config.videoExtensions));
  const normalizedDirPath = normalizePath(dirPath);
  const videoCountInDir = videoCountMap[normalizedDirPath] || 0;

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

    const posterPath = findPosterInDir(dirPath);
    const spritePath = findSpriteInDir(dirPath, videoFile);

    const video = {
      id: generateId(videoPath),
      title: getTitleFromPath(videoPath, videoCountInDir),
      directory: normalizePath(dirPath),
      hardDrive: hardDrive,
      videoPath: normalizePath(videoPath),
      posterPath: posterPath ? normalizePath(posterPath) : undefined,
      spritePath: spritePath ? normalizePath(spritePath) : undefined,
      videoExtension: path.extname(videoFile).toLowerCase(),
      posterExtension: posterPath ? path.extname(posterPath) : undefined,
      fileSize: videoStat.size,
      createdAt: videoStat.birthtimeMs,
      updatedAt: videoStat.mtimeMs,
    };

    results.videos.push(video);

    if (!results.directories.includes(normalizePath(dirPath))) {
      results.directories.push(normalizePath(dirPath));
    }
  }

  if (config.recursive) {
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        continue;
      }
      if (stat.isDirectory() && !isSystemDirectory(file)) {
        scanDirectory(fullPath, hardDrive, results, videoCountMap);
      }
    }
  }
}

// 主扫描函数
function scan() {
  console.log('开始扫描...');
  console.log('配置的硬盘:', config.hardDrives);

  ensureDataDir();

  const results = {
    version: '2.0.0',
    generatedAt: Date.now(),
    hardDrives: config.hardDrives.filter(hd => fs.existsSync(hd)),
    directories: [],
    directoryTree: [],
    videos: [],
  };

  // 首先统计每个目录下的视频数量
  const videoCountMap = {};
  for (const hardDrive of config.hardDrives) {
    if (fs.existsSync(hardDrive)) {
      countVideosInDirectory(hardDrive, videoCountMap);
    }
  }

  for (const hardDrive of config.hardDrives) {
    if (!fs.existsSync(hardDrive)) {
      console.warn(`硬盘不存在或未挂载: ${hardDrive}`);
      continue;
    }
    console.log(`正在扫描: ${hardDrive}`);

    const tree = buildDirectoryTree(hardDrive, hardDrive);
    // 只添加有内容的根目录（有视频、有主图、或有子目录）
    const rootHasPoster = hasPosterInDir(hardDrive);
    if (tree.videoCount > 0 || rootHasPoster || tree.children.length > 0) {
      results.directoryTree.push(tree);
    }

    scanDirectory(hardDrive, hardDrive, results, videoCountMap);
  }

  results.videos.sort((a, b) => {
    if (a.directory !== b.directory) {
      return a.directory.localeCompare(b.directory);
    }
    return a.title.localeCompare(b.title);
  });

  fs.writeFileSync(config.outputPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`扫描完成!`);
  console.log(`- 找到 ${results.videos.length} 个视频`);
  console.log(`- 涉及 ${results.directories.length} 个目录`);
  console.log(`- 数据已保存到: ${config.outputPath}`);

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
