const express = require('express');
const path = require('path');
const fs = require('fs');
const { isPathAllowed } = require('../middleware/path');
const { getVideoMimeType, safeOpen } = require('../utils');
const { checkFFmpeg } = require('../../scanner/spriteGenerator');
const config = require('../../scanner/config');
const { clearVideoDataCache } = require('../middleware/cache');

const router = express.Router();

const VIDEO_CHUNK_SIZE = 50 * 1024 * 1024;
const STREAM_HIGH_WATER_MARK = 64 * 1024;

router.get('/video', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  let stream = null;

  // 清理函数：确保流和句柄都被释放
  const cleanup = () => {
    if (stream) {
      stream.destroy();
      stream = null;
    }
  };

  // 监听连接关闭，确保清理资源
  req.on('close', cleanup);
  req.on('abort', cleanup);
  res.on('finish', cleanup);
  res.on('close', cleanup);

  try {
    const stat = fs.statSync(resolvedPath);
    const range = req.headers.range;
    const contentType = getVideoMimeType(resolvedPath);

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + VIDEO_CHUNK_SIZE, stat.size - 1);
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });

      stream = fs.createReadStream(resolvedPath, {
        start,
        end,
        highWaterMark: STREAM_HIGH_WATER_MARK
      });

      stream.on('error', (err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: '视频流读取失败' });
        } else {
          res.end();
        }
        cleanup();
      });

      stream.on('end', cleanup);
      stream.pipe(res);
    } else {
      const end = Math.min(VIDEO_CHUNK_SIZE - 1, stat.size - 1);
      res.writeHead(206, {
        'Content-Range': `bytes 0-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end + 1,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });

      stream = fs.createReadStream(resolvedPath, {
        start: 0,
        end,
        highWaterMark: STREAM_HIGH_WATER_MARK
      });

      stream.on('error', (err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: '视频流读取失败' });
        } else {
          res.end();
        }
        cleanup();
      });

      stream.on('end', cleanup);
      stream.pipe(res);
    }
  } catch (err) {
    cleanup();
    res.status(500).json({ error: '读取视频失败: ' + err.message });
  }
});

router.get('/image', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.vtt') contentType = 'text/vtt; charset=utf-8';
  else if (ext === '.json') contentType = 'application/json; charset=utf-8';

  const isCacheable = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  const headers = {
    'Content-Type': contentType,
  };
  if (isCacheable) {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  let stream = null;

  // 清理函数：确保流和句柄都被释放
  const cleanup = () => {
    if (stream) {
      stream.destroy();
      stream = null;
    }
  };

  // 监听连接关闭，确保清理资源
  req.on('close', cleanup);
  req.on('abort', cleanup);
  res.on('finish', cleanup);
  res.on('close', cleanup);

  res.writeHead(200, headers);
  stream = fs.createReadStream(resolvedPath);

  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: '图片读取失败' });
    } else {
      res.end();
    }
    cleanup();
  });

  stream.on('end', cleanup);
  stream.pipe(res);
});

router.post('/open-video', (req, res) => {
  const filePath = req.body.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  console.log('打开视频:', resolvedPath);

  safeOpen(resolvedPath, false)
    .then(() => res.json({ success: true }))
    .catch((err) => {
      console.warn('打开文件失败:', err.message);
      res.json({ success: true });
    });
});

router.post('/open-directory', (req, res) => {
  const dirPath = req.body.path;
  if (!dirPath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '目录不存在' });
  }

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  console.log('打开目录:', resolvedPath);

  safeOpen(resolvedPath, true)
    .then(() => res.json({ success: true }))
    .catch((err) => {
      console.warn('打开目录失败:', err.message);
      res.json({ success: true });
    });
});

// API: 检查 FFmpeg 状态
router.get('/ffmpeg/status', async (req, res) => {
  try {
    const status = await checkFFmpeg();
    res.json(status);
  } catch (err) {
    console.error('检查 FFmpeg 失败:', err);
    res.json({
      available: false,
      path: null,
      message: '检查 FFmpeg 时出错: ' + err.message
    });
  }
});

// API: 删除视频目录
// 简单的内存速率限制
const deleteRequests = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1分钟
const MAX_DELETES_PER_WINDOW = 3; // 最多3次删除

function checkRateLimit(clientId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  let requests = deleteRequests.get(clientId) || [];
  // 清理过期记录
  requests = requests.filter(time => time > windowStart);

  if (requests.length >= MAX_DELETES_PER_WINDOW) {
    return false;
  }

  requests.push(now);
  deleteRequests.set(clientId, requests);

  // 清理旧记录以防止内存泄漏
  for (const [id, times] of deleteRequests) {
    if (times.filter(t => t > windowStart).length === 0) {
      deleteRequests.delete(id);
    }
  }

  return true;
}

router.post('/delete-directory', async (req, res) => {
  const dirPath = req.body.path;
  if (!dirPath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  // 速率限制检查
  const clientId = req.ip || 'unknown';
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({ error: '操作过于频繁，请稍后再试' });
  }

  const resolvedPath = path.resolve(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '目录不存在' });
  }

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  // 安全检查：确保要删除的是一个目录
  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: '路径不是一个目录' });
  }

  // 安全检查：禁止删除硬盘根目录
  const parsedPath = path.parse(resolvedPath);
  const isRootDir = parsedPath.dir === '' ||
                    (process.platform === 'win32' && parsedPath.root === resolvedPath);
  if (isRootDir) {
    return res.status(400).json({ error: '禁止删除根目录' });
  }

  // 读取当前视频数据
  const dataPath = path.resolve(config.outputPath);
  let videoData = null;
  if (fs.existsSync(dataPath)) {
    videoData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  }

  // 安全检查：只允许删除有视频记录的目录
  const normalizedDeletedPath = resolvedPath.replace(/\\/g, '/');
  const hasVideosInDir = videoData && videoData.videos && videoData.videos.some(video => {
    const videoDir = path.resolve(video.directory).replace(/\\/g, '/');
    return videoDir === normalizedDeletedPath ||
           videoDir.startsWith(normalizedDeletedPath + '/');
  });

  if (!hasVideosInDir) {
    return res.status(400).json({ error: '该目录没有关联的视频记录，无法删除' });
  }

  console.log('删除目录:', resolvedPath);

  try {
    // 确定记录文件的位置
    function findRecordLocation(dirPath) {
      const normalizedPath = dirPath.replace(/\\/g, '/');
      const pathParts = normalizedPath.split('/').filter(p => p);

      // 如果少于2部分（只有盘符），则使用父目录
      if (pathParts.length < 2) {
        return path.dirname(dirPath);
      }

      // 路径结构示例：
      // 情况1: ['W:', '演员名', '2023-12', '视频名'] -> 记录在 'W:/演员名'
      // 情况2: ['W:', '演员名', '视频名'] -> 记录在 'W:/演员名'
      // 情况3: ['W:', '杂目录', '视频名'] -> 记录在 'W:/杂目录'

      // 总是记录在盘符后的第一层目录（索引1）
      let recordDirIndex = 1;

      // 构建记录目录路径
      let recordDir;
      if (process.platform === 'win32') {
        // Windows: 盘符 + 第一层目录
        recordDir = pathParts[0] + '\\' + pathParts[1];
      } else {
        // Unix-like: /第一层目录
        recordDir = '/' + pathParts[1];
      }

      return recordDir;
    }

    // 在删除前创建删除记录
    const recordDir = findRecordLocation(resolvedPath);

    // 确保记录目录存在（理论上应该存在，但防万一）
    if (!fs.existsSync(recordDir)) {
      console.log('记录目录不存在，使用父目录:', recordDir);
      recordDir = path.dirname(resolvedPath);
    }

    const recordFilePath = path.join(recordDir, 'deleted_video_dirs.txt');
    const timestamp = new Date().toISOString();
    const recordEntry = `[${timestamp}] ${resolvedPath}\n`;

    // 追加或创建记录文件
    fs.appendFileSync(recordFilePath, recordEntry, 'utf-8');
    console.log('已记录删除操作:', recordFilePath);

    // 递归删除目录
    function deleteDirectoryRecursive(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const fileStat = fs.statSync(filePath);
        if (fileStat.isDirectory()) {
          deleteDirectoryRecursive(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(dir);
    }

    deleteDirectoryRecursive(resolvedPath);

    // 更新 videos.json，移除该目录下的所有视频
    if (videoData) {
      const data = videoData;
      const normalizedDeletedPath = resolvedPath.replace(/\\/g, '/');

      // 过滤掉该目录下的视频
      data.videos = data.videos.filter(video => {
        const videoDir = path.resolve(video.directory).replace(/\\/g, '/');
        return videoDir !== normalizedDeletedPath &&
               !videoDir.startsWith(normalizedDeletedPath + '/');
      });

      // 重新计算目录和硬盘信息
      const directoriesSet = new Set();
      const hardDrivesSet = new Set();

      data.videos.forEach(video => {
        directoriesSet.add(video.directory);
        hardDrivesSet.add(video.hardDrive);
      });

      data.directories = Array.from(directoriesSet).sort();
      data.hardDrives = Array.from(hardDrivesSet).sort();

      // 重新构建目录树
      function buildDirectoryTree(directories, videos) {
        const pathMap = new Map();
        const roots = [];

        directories.forEach(dirPath => {
          const pathParts = dirPath.split('/').filter(p => p);
          let currentPath = '';
          let parentNode = null;

          for (const part of pathParts) {
            currentPath = currentPath ? currentPath + '/' + part : part;

            if (!pathMap.has(currentPath)) {
              const node = {
                name: part,
                path: currentPath,
                parentPath: parentNode ? parentNode.path : '',
                children: [],
                videoCount: 0
              };

              pathMap.set(currentPath, node);

              if (parentNode) {
                parentNode.children.push(node);
              } else {
                roots.push(node);
              }
            }

            parentNode = pathMap.get(currentPath);
          }
        });

        // 计算每个目录的视频数量
        videos.forEach(video => {
          let dir = video.directory;
          while (dir && pathMap.has(dir)) {
            const node = pathMap.get(dir);
            node.videoCount++;
            const lastSlash = dir.lastIndexOf('/');
            dir = lastSlash > 0 ? dir.substring(0, lastSlash) : '';
          }
        });

        return roots;
      }

      data.directoryTree = buildDirectoryTree(data.directories, data.videos);
      data.generatedAt = Date.now();

      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');

      // 清除缓存
      clearVideoDataCache();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('删除目录失败:', err);
    res.status(500).json({ error: '删除失败: ' + err.message });
  }
});

module.exports = router;
