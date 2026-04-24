const express = require('express');
const cors = require('cors');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { Worker } = require('worker_threads');
const os = require('os');
const { checkFFmpeg, generateSprite } = require('../scanner/spriteGenerator');
const SpriteThreadPool = require('../scanner/spriteThreadPool');
const config = require('../scanner/config');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ========== 缓存系统 ==========
let videoDataCache = null;
let videoDataCacheTime = 0;
const CACHE_TTL = 60000; // 60秒缓存（扫描完成时会主动清除）

// 带缓存的视频数据读取
function getVideoData() {
  const now = Date.now();
  if (videoDataCache && (now - videoDataCacheTime) < CACHE_TTL) {
    return videoDataCache;
  }
  try {
    const dataPath = path.resolve(config.outputPath);
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      videoDataCache = data;
      videoDataCacheTime = now;
      return data;
    }
  } catch (err) {
    console.error('读取视频数据失败:', err);
  }
  return null;
}

// 清除视频数据缓存
function clearVideoDataCache() {
  videoDataCache = null;
  videoDataCacheTime = 0;
}

// WebSocket 广播节流
let broadcastTimeout = null;
let pendingBroadcast = false;

// WebSocket 连接管理
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('WebSocket 客户端已连接');

  // 发送当前状态给新连接的客户端
  sendSpriteStatusToClient(ws);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket 客户端已断开');
  });
});

// 节流的雪碧图状态广播（最多每100ms一次）
function broadcastSpriteStatus() {
  if (broadcastTimeout) {
    pendingBroadcast = true;
    return;
  }

  doBroadcast();

  broadcastTimeout = setTimeout(() => {
    broadcastTimeout = null;
    if (pendingBroadcast) {
      pendingBroadcast = false;
      doBroadcast();
    }
  }, 100);
}

function doBroadcast() {
  const allStatus = Array.from(spriteGenerationStatusMap.values());
  const message = JSON.stringify({
    type: 'spriteStatus',
    data: {
      inProgress: spriteGenerationInProgressSet.size > 0,
      allStatus: allStatus
    }
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 广播批量雪碧图生成状态
function broadcastBatchSpriteStatus(stats) {
  const message = JSON.stringify({
    type: 'batchSpriteStatus',
    data: stats
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 广播扫描状态变更
function broadcastScanStatus(status) {
  const message = JSON.stringify({
    type: 'scanStatus',
    data: status
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 发送雪碧图状态给单个客户端
function sendSpriteStatusToClient(ws) {
  const allStatus = Array.from(spriteGenerationStatusMap.values());
  const message = JSON.stringify({
    type: 'spriteStatus',
    data: {
      inProgress: spriteGenerationInProgressSet.size > 0,
      allStatus: allStatus
    }
  });
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }

  // 如果有批量任务在运行，也发送批量状态
  if (batchThreadPool) {
    const batchMessage = JSON.stringify({
      type: 'batchSpriteStatus',
      data: batchThreadPool.getStats()
    });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(batchMessage);
    }
  }
}

// 视频路径到信息的内存缓存
let videoInfoCache = new Map();

// 根据视频路径获取视频标题（带缓存）
function getVideoTitleByPath(videoPath) {
  const normalizedPath = normalizePath(videoPath);
  const cached = videoInfoCache.get(normalizedPath);
  if (cached && cached.title) {
    return cached.title;
  }

  const data = getVideoData();
  if (data && data.videos) {
    const video = data.videos.find(v => normalizePath(v.videoPath) === normalizedPath);
    if (video) {
      videoInfoCache.set(normalizedPath, { title: video.title, id: video.id });
      return video.title;
    }
  }
  return null;
}

// 根据视频路径获取视频ID（带缓存）
function getVideoIdByPath(videoPath) {
  const normalizedPath = normalizePath(videoPath);
  const cached = videoInfoCache.get(normalizedPath);
  if (cached && cached.id) {
    return cached.id;
  }

  const data = getVideoData();
  if (data && data.videos) {
    const video = data.videos.find(v => normalizePath(v.videoPath) === normalizedPath);
    if (video) {
      videoInfoCache.set(normalizedPath, { title: video.title, id: video.id });
      return video.id;
    }
  }
  return null;
}

// 中间件
app.use(cors());
app.use(express.json());

// 扫描状态
let scanInProgress = false;
let lastScanResult = null;

// 确保数据文件存在
function ensureDataFile() {
  const dataPath = path.resolve(config.outputPath);
  if (!fs.existsSync(dataPath)) {
    const dataDir = path.dirname(dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const initialData = {
      version: '1.0.0',
      generatedAt: Date.now(),
      hardDrives: [],
      directories: [],
      videos: [],
    };
    fs.writeFileSync(dataPath, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// API: 获取视频数据（带缓存，支持分页）
app.get('/api/videos', (req, res) => {
  try {
    ensureDataFile();
    const data = getVideoData() || JSON.parse(fs.readFileSync(path.resolve(config.outputPath), 'utf-8'));

    // 自动补全 spriteVttPath（根据 spritePath 推断）
    if (data.videos && Array.isArray(data.videos)) {
      data.videos = data.videos.map(video => {
        if (video.spritePath && !video.spriteVttPath) {
          const vttPath = video.spritePath.replace(/\.(jpg|jpeg|png)$/, '.vtt');
          return {
            ...video,
            spriteVttPath: vttPath
          };
        }
        return video;
      });
    }

    // 支持分页参数：page（页码，从1开始），limit（每页数量）
    const page = parseInt(req.query.page, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 0;

    if (page > 0 && limit > 0) {
      const totalVideos = data.videos.length;
      const startIdx = (page - 1) * limit;
      const pagedVideos = data.videos.slice(startIdx, startIdx + limit);

      res.json({
        ...data,
        videos: pagedVideos,
        pagination: {
          page,
          limit,
          total: totalVideos,
          totalPages: Math.ceil(totalVideos / limit),
        },
      });
    } else {
      res.json(data);
    }
  } catch (err) {
    console.error('读取视频数据失败:', err);
    res.status(500).json({ error: '读取数据失败' });
  }
});

// API: 触发扫描
app.post('/api/scan', (req, res) => {
  if (scanInProgress) {
    return res.json({ success: false, message: '扫描正在进行中' });
  }

  scanInProgress = true;
  res.json({ success: true, message: '扫描已开始' });

  // 在 Worker 线程中异步执行扫描，避免阻塞事件循环
  const scanWorker = new Worker(path.join(__dirname, '..', 'scanner', 'scanWorker.js'));

  scanWorker.on('message', (message) => {
    if (message.type === 'success') {
      lastScanResult = message.result;
      clearVideoDataCache();
      videoInfoCache.clear();
      broadcastScanStatus({ scanning: false, success: true, videoCount: message.result?.videos?.length || 0 });
    } else {
      console.error('扫描出错:', message.error);
      broadcastScanStatus({ scanning: false, success: false, error: message.error });
    }
    scanInProgress = false;
    scanWorker.terminate();
  });

  scanWorker.on('error', (err) => {
    console.error('扫描 Worker 错误:', err);
    broadcastScanStatus({ scanning: false, success: false, error: err.message });
    scanInProgress = false;
    scanWorker.terminate();
  });

  scanWorker.on('exit', (code) => {
    if (code !== 0) {
      console.error('扫描 Worker 异常退出，退出码:', code);
      broadcastScanStatus({ scanning: false, success: false, error: '扫描进程异常退出' });
      scanInProgress = false;
    }
  });
});

// API: 获取扫描状态
app.get('/api/scan/status', (req, res) => {
  let videoCount = 0;
  let lastScan = null;

  try {
    const dataPath = path.resolve(config.outputPath);
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      videoCount = data.videos?.length || 0;
      lastScan = data.generatedAt || null;
    }
  } catch (err) {
    console.error('读取状态失败:', err);
  }

  res.json({
    scanning: scanInProgress,
    lastScan: lastScan,
    videoCount: videoCount,
  });
});

// 根据文件扩展名获取视频 MIME 类型
function getVideoMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.m4v': 'video/x-m4v',
  };
  return mimeTypes[ext] || 'video/mp4';
}

// 视频流传输分块大小（50MB）
const VIDEO_CHUNK_SIZE = 50 * 1024 * 1024;
// 流缓冲区大小（64KB）
const STREAM_HIGH_WATER_MARK = 64 * 1024;

// API: 提供视频文件流式访问
app.get('/api/video', (req, res) => {
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

      const stream = fs.createReadStream(resolvedPath, {
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
      });
      stream.pipe(res);
    } else {
      // 不使用完整文件传输，强制使用 range
      const end = Math.min(VIDEO_CHUNK_SIZE - 1, stat.size - 1);
      res.writeHead(206, {
        'Content-Range': `bytes 0-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end + 1,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });

      const stream = fs.createReadStream(resolvedPath, {
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
      });
      stream.pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: '读取视频失败: ' + err.message });
  }
});

// API: 提供图片文件访问（带缓存）
app.get('/api/image', (req, res) => {
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

  // 图片文件缓存1小时，VTT和JSON不缓存
  const isCacheable = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  const headers = {
    'Content-Type': contentType,
  };
  if (isCacheable) {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  res.writeHead(200, headers);
  const stream = fs.createReadStream(resolvedPath);
  stream.pipe(res);
});

// API: 用本地播放器打开视频
app.post('/api/open-video', (req, res) => {
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

// API: 打开文件所在目录
app.post('/api/open-directory', (req, res) => {
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
app.get('/api/ffmpeg/status', async (req, res) => {
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


// 雪碧图生成状态 - 支持多个同时生成
const spriteGenerationInProgressSet = new Set();
const spriteGenerationStatusMap = new Map();

// 批量雪碧图生成状态
let batchThreadPool = null;

// API: 生成雪碧图（支持多个同时生成）
app.post('/api/sprite/generate', async (req, res) => {
  const videoPath = req.body.path;
  const force = req.body.force || false;
  if (!videoPath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(videoPath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '视频文件不存在' });
  }

  // 检查 FFmpeg
  const ffmpegStatus = await checkFFmpeg();
  if (!ffmpegStatus.available) {
    return res.json({
      success: false,
      message: ffmpegStatus.message || 'FFmpeg 不可用'
    });
  }

  // 如果这个视频已经在生成中，不重复生成
  if (spriteGenerationInProgressSet.has(resolvedPath)) {
    return res.json({ success: false, message: '这个视频正在生成中' });
  }

  // 检查正在运行的任务数量，最多5个
  const inProgressCount = spriteGenerationInProgressSet.size;
  if (inProgressCount >= 5) {
    return res.json({ success: false, message: '正在生成的任务已达5个，请稍后再试' });
  }

  // 确保最多5个任务，超过就删除最先完成的（优先删除已完成的）
  const allStatuses = Array.from(spriteGenerationStatusMap.values());
  if (allStatuses.length >= 5) {
    // 分成已完成和进行中
    const completedStatuses = allStatuses.filter(s =>
      s.videoPath && !spriteGenerationInProgressSet.has(s.videoPath)
    );
    const inProgressStatuses = allStatuses.filter(s =>
      s.videoPath && spriteGenerationInProgressSet.has(s.videoPath)
    );

    // 优先删除已完成的，按完成时间（updatedAt）从老到新
    completedStatuses.sort((a, b) => (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0));
    let needToDelete = allStatuses.length - 5 + 1; // 腾位置给新任务，保持最多5个（现有5个+新1个=6个，删1个）
    for (const status of completedStatuses) {
      if (needToDelete <= 0) break;
      if (status.videoPath) {
        spriteGenerationStatusMap.delete(status.videoPath);
        needToDelete--;
      }
    }

    // 如果还需要删除，就连进行中的一起删（最老的）
    if (needToDelete > 0) {
      inProgressStatuses.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      for (const status of inProgressStatuses) {
        if (needToDelete <= 0) break;
        if (status.videoPath) {
          spriteGenerationStatusMap.delete(status.videoPath);
          spriteGenerationInProgressSet.delete(status.videoPath);
          needToDelete--;
        }
      }
    }
  }

  // 标记为生成中
  spriteGenerationInProgressSet.add(resolvedPath);
  const initialStatus = {
    videoPath: resolvedPath,
    videoId: getVideoIdByPath(resolvedPath),
    videoTitle: getVideoTitleByPath(resolvedPath),
    percent: 0,
    message: '开始生成...',
    createdAt: Date.now()
  };
  spriteGenerationStatusMap.set(resolvedPath, initialStatus);

  // 广播状态 - 发送所有正在生成的状态
  broadcastSpriteStatus();

  res.json({ success: true, message: '雪碧图生成已开始' });

  // 异步执行生成
  (async () => {
    try {
      const result = await generateSprite(resolvedPath, { force }, (progress) => {
        const existingStatus = spriteGenerationStatusMap.get(resolvedPath);
        const status = {
          videoPath: resolvedPath,
          videoId: getVideoIdByPath(resolvedPath),
          videoTitle: getVideoTitleByPath(resolvedPath),
          percent: progress.percent || 0,
          message: progress.message || '处理中...',
          stage: progress.stage,
          frameCount: progress.frameCount,
          totalFrames: progress.totalFrames,
          createdAt: existingStatus?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        spriteGenerationStatusMap.set(resolvedPath, status);
        console.log('进度更新:', path.basename(resolvedPath), status.percent + '%', status.message);
        broadcastSpriteStatus();
      });

      // 更新 videos.json 添加雪碧图路径和 VTT 路径
      const dataPath = path.resolve(config.outputPath);
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        const videoIndex = data.videos.findIndex(v => v.videoPath === normalizePath(resolvedPath));
        if (videoIndex !== -1) {
          data.videos[videoIndex].spritePath = normalizePath(result.spritePath);
          const vttPath = result.spritePath.replace(/\.(jpg|jpeg|png)$/, '.vtt');
          data.videos[videoIndex].spriteVttPath = normalizePath(vttPath);
          fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
          clearVideoDataCache();
        }
      }

      const existingStatus = spriteGenerationStatusMap.get(resolvedPath);
      const finalStatus = {
        ...result,
        videoPath: resolvedPath,
        videoId: getVideoIdByPath(resolvedPath),
        videoTitle: getVideoTitleByPath(resolvedPath),
        percent: 100,
        createdAt: existingStatus?.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      spriteGenerationStatusMap.set(resolvedPath, finalStatus);
      broadcastSpriteStatus();

      // 等待1秒，确保前端收到最后的100%更新
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('生成雪碧图失败:', err);
      const existingStatus = spriteGenerationStatusMap.get(resolvedPath);
      const errorStatus = {
        error: true,
        videoPath: resolvedPath,
        videoId: getVideoIdByPath(resolvedPath),
        videoTitle: getVideoTitleByPath(resolvedPath),
        message: '生成失败: ' + err.message,
        createdAt: existingStatus?.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      spriteGenerationStatusMap.set(resolvedPath, errorStatus);
      broadcastSpriteStatus();
    } finally {
      spriteGenerationInProgressSet.delete(resolvedPath);
      broadcastSpriteStatus();
    }
  })();
});

// API: 获取雪碧图生成状态
app.get('/api/sprite/status', (req, res) => {
  const allStatus = Array.from(spriteGenerationStatusMap.values()).map(status => ({
    ...status,
    videoTitle: status.videoTitle || (status.videoPath ? getVideoTitleByPath(status.videoPath) : undefined)
  }));
  res.json({
    inProgress: spriteGenerationInProgressSet.size > 0,
    allStatus: allStatus
  });
});

// API: 获取雪碧图信息
app.get('/api/sprite/info', (req, res) => {
  const spritePath = req.query.path;
  if (!spritePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(spritePath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }
  const infoPath = resolvedPath.replace(/\.(jpg|jpeg|png)$/, '.json');

  if (!fs.existsSync(infoPath)) {
    return res.status(404).json({ error: '雪碧图信息文件不存在' });
  }

  try {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: '读取雪碧图信息失败' });
  }
});

// API: 批量生成雪碧图
app.post('/api/sprite/batch-generate', async (req, res) => {
  const videoPaths = req.body.paths;
  const force = req.body.force || false;
  // 限制线程池大小：至少1个，最多CPU核心数
  const maxPoolSize = os.cpus().length;
  const poolSize = Math.max(1, Math.min(req.body.poolSize || (maxPoolSize - 1 || 1), maxPoolSize));

  if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length === 0) {
    return res.status(400).json({ error: '缺少 paths 参数或为空数组' });
  }

  const batchIsRunning = batchThreadPool && batchThreadPool.isRunning === true;
  if (spriteGenerationInProgressSet.size > 0 || batchIsRunning) {
    return res.json({ success: false, message: '正在生成其他雪碧图，请稍候...' });
  }

  // 检查 FFmpeg
  const ffmpegStatus = await checkFFmpeg();
  if (!ffmpegStatus.available) {
    return res.json({
      success: false,
      message: ffmpegStatus.message || 'FFmpeg 不可用'
    });
  }

  // 验证视频文件存在且在允许的目录内
  const validPaths = [];
  for (const videoPath of videoPaths) {
    const resolvedPath = path.resolve(videoPath);
    if (isPathAllowed(resolvedPath) && fs.existsSync(resolvedPath)) {
      validPaths.push(resolvedPath);
    }
  }

  if (validPaths.length === 0) {
    return res.json({ success: false, message: '没有有效的视频文件' });
  }

  // 创建线程池
  batchThreadPool = new SpriteThreadPool({ poolSize });
  batchThreadPool.addVideos(validPaths, { force });

  // 注册事件监听
  batchThreadPool.on('start', (data) => {
    console.log('[批量生成] 开始:', data);
    broadcastBatchSpriteStatus(batchThreadPool.getStats());
  });

  batchThreadPool.on('progress', (data) => {
    broadcastBatchSpriteStatus({
      ...batchThreadPool.getStats(),
      currentVideo: data
    });
  });

  batchThreadPool.on('videoComplete', async (data) => {
    console.log('[批量生成] 视频完成:', path.basename(data.videoPath));

    // 更新 videos.json
    if (data.success && data.spritePath) {
      const dataPath = path.resolve(config.outputPath);
      if (fs.existsSync(dataPath)) {
        try {
          const videoData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
          const videoIndex = videoData.videos.findIndex(v => normalizePath(v.videoPath) === normalizePath(data.videoPath));
          if (videoIndex !== -1) {
            videoData.videos[videoIndex].spritePath = normalizePath(data.spritePath);
            const vttPath = data.spritePath.replace(/\.(jpg|jpeg|png)$/, '.vtt');
            videoData.videos[videoIndex].spriteVttPath = normalizePath(vttPath);
            fs.writeFileSync(dataPath, JSON.stringify(videoData, null, 2), 'utf-8');
            clearVideoDataCache();
          }
        } catch (err) {
          console.error('更新 videos.json 失败:', err);
        }
      }
    }

    broadcastBatchSpriteStatus(batchThreadPool.getStats());
  });

  batchThreadPool.on('videoError', (data) => {
    console.error('[批量生成] 视频失败:', path.basename(data.videoPath), data.error);
    broadcastBatchSpriteStatus(batchThreadPool.getStats());
  });

  batchThreadPool.on('done', (data) => {
    console.log('[批量生成] 完成:', data.stats);
    broadcastBatchSpriteStatus({ ...data.stats, done: true });

    // 立即清理线程池引用
    batchThreadPool = null;
  });

  // 启动处理
  batchThreadPool.start();

  res.json({
    success: true,
    message: `批量生成已开始，共 ${validPaths.length} 个视频`,
    total: validPaths.length
  });
});

// API: 获取批量生成状态
app.get('/api/sprite/batch-status', (req, res) => {
  if (!batchThreadPool) {
    return res.json({
      isRunning: false,
      stats: null
    });
  }
  res.json({
    isRunning: batchThreadPool.isRunning,
    stats: batchThreadPool.getStats()
  });
});

// API: 中止批量生成
app.post('/api/sprite/batch-abort', (req, res) => {
  if (!batchThreadPool || !batchThreadPool.isRunning) {
    return res.json({ success: false, message: '没有正在进行的批量生成' });
  }

  batchThreadPool.abort();
  res.json({ success: true, message: '已发送中止信号' });
});

// 规范化路径分隔符
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

// 获取允许访问的目录列表
function getAllowedDirectories() {
  const allowed = [...config.hardDrives];
  // 也允许数据输出目录
  const outputDir = path.resolve(path.dirname(config.outputPath));
  if (!allowed.includes(outputDir)) {
    allowed.push(outputDir);
  }
  return allowed;
}

// 校验路径是否在允许的目录范围内，防止路径遍历攻击
function isPathAllowed(resolvedPath) {
  const normalizedPath = normalizePath(path.resolve(resolvedPath));
  const allowedDirs = getAllowedDirectories();

  for (const dir of allowedDirs) {
    let normalizedDir = normalizePath(path.resolve(dir));

    // 处理 Windows 盘符情况（如 "W:" -> "W:/"）
    if (process.platform === 'win32' && /^[A-Za-z]:$/.test(normalizedDir)) {
      normalizedDir = normalizedDir + '/';
    }

    // 确保目录路径以分隔符结尾，便于前缀匹配
    const dirWithSlash = normalizedDir.endsWith('/') ? normalizedDir : normalizedDir + '/';

    if (normalizedPath === normalizedDir || normalizedPath.startsWith(dirWithSlash)) {
      return true;
    }
  }

  console.log('路径被拒绝:', normalizedPath, '允许的目录:', allowedDirs);
  return false;
}

// 安全地打开文件或目录（使用 spawn 代替字符串拼接，防止命令注入）
function safeOpen(targetPath, isDirectory = false) {
  const resolvedPath = path.resolve(targetPath);
  if (!isPathAllowed(resolvedPath)) {
    return Promise.reject(new Error('路径不在允许范围内'));
  }

  return new Promise((resolve, reject) => {
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        // 使用 spawn 传参方式避免命令注入
        if (isDirectory) {
          spawn('explorer', [resolvedPath], { detached: true, stdio: 'ignore' });
        } else {
          spawn('cmd', ['/c', 'start', '', resolvedPath], { detached: true, stdio: 'ignore' });
        }
      } else if (platform === 'darwin') {
        spawn('open', [resolvedPath], { detached: true, stdio: 'ignore' });
      } else {
        spawn('xdg-open', [resolvedPath], { detached: true, stdio: 'ignore' });
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// 启动服务器
ensureDataFile();
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 端点:`);
  console.log(`  GET  /api/videos       - 获取视频列表`);
  console.log(`  POST /api/scan         - 触发重新扫描`);
  console.log(`  GET  /api/scan/status  - 获取扫描状态`);
  console.log(`  GET  /api/video        - 视频文件流式服务`);
  console.log(`  GET  /api/image        - 图片文件服务`);
  console.log(`  POST /api/open-video   - 用本地播放器打开视频`);
  console.log(`  POST /api/open-directory - 打开文件所在目录`);
  console.log(`  GET  /api/ffmpeg/status - 检查 FFmpeg 状态`);
  console.log(`  POST /api/sprite/generate - 生成雪碧图`);
  console.log(`  GET  /api/sprite/status - 获取雪碧图生成状态`);
  console.log(`  GET  /api/sprite/info - 获取雪碧图信息`);
  console.log(`  POST /api/sprite/batch-generate - 批量生成雪碧图`);
  console.log(`  GET  /api/sprite/batch-status - 获取批量生成状态`);
  console.log(`  POST /api/sprite/batch-abort - 中止批量生成`);
  console.log(`WebSocket: ws://localhost:${PORT} - 实时状态推送`);
});
