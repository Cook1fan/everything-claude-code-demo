const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { checkFFmpeg, generateSprite, abortSpriteGeneration } = require('../../scanner/spriteGenerator');
const SpriteThreadPool = require('../../scanner/spriteThreadPool');
const config = require('../../scanner/config');
const { isPathAllowed, normalizePath } = require('../middleware/path');
const { getVideoData, clearVideoDataCache } = require('../middleware/cache');
const { getVideoIdByPath, getVideoTitleByPath } = require('../middleware/video-info');
const {
  getSpriteSemaphore,
  getBatchThreadPool,
  setBatchThreadPool,
  broadcastBatchSpriteStatus
} = require('../websocket');

const router = express.Router();

// API: 生成雪碧图（加入队列排队）
router.post('/generate', async (req, res) => {
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

  const semaphore = getSpriteSemaphore();

  // 检查视频是否已经在队列中或正在运行
  if (semaphore.isVideoInQueueOrRunning(resolvedPath)) {
    return res.json({ success: false, message: '这个视频已在队列中或正在生成' });
  }

  // 清理旧状态，已结束的最多保留10个，排队和运行中的全部保留
  semaphore.cleanupOldStatuses(10);

  // 提交任务到队列
  const taskId = semaphore.submit(
    resolvedPath,
    { force },
    async (abortController, onProgress) => {
      // 实际执行生成的函数
      const result = await generateSprite(resolvedPath, { force }, onProgress, abortController);

      // 更新 videos.json 添加雪碧图路径和 VTT 路径
      const dataPath = path.resolve(config.outputPath);
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        const videoIndex = data.videos.findIndex(v => normalizePath(v.videoPath) === normalizePath(resolvedPath));
        if (videoIndex !== -1) {
          data.videos[videoIndex].spritePath = normalizePath(result.spritePath);
          const vttPath = result.spritePath.replace(/\.(jpg|jpeg|png)$/, '.vtt');
          data.videos[videoIndex].spriteVttPath = normalizePath(vttPath);
          fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
          clearVideoDataCache();
        }
      }

      // 短暂延迟，确保前端收到 100% 的更新
      await new Promise(resolve => setTimeout(resolve, 1000));

      return result;
    },
    {
      videoId: getVideoIdByPath(resolvedPath),
      videoTitle: getVideoTitleByPath(resolvedPath)
    }
  );

  const status = semaphore.getStatusByVideoPath(resolvedPath);
  res.json({
    success: true,
    message: status.queuePosition ? `已加入队列，位置 ${status.queuePosition}` : '雪碧图生成已开始',
    taskId,
    queuePosition: status.queuePosition
  });
});

// API: 获取雪碧图生成状态
router.get('/status', (req, res) => {
  const semaphore = getSpriteSemaphore();
  const allStatus = semaphore.getAllStatuses().map(status => ({
    ...status,
    videoTitle: status.videoTitle || (status.videoPath ? getVideoTitleByPath(status.videoPath) : undefined)
  }));
  res.json({
    inProgress: semaphore.getActiveCount() > 0,
    queueLength: semaphore.getQueueLength(),
    allStatus: allStatus
  });
});

// API: 获取雪碧图信息
router.get('/info', (req, res) => {
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
router.post('/batch-generate', async (req, res) => {
  const videoPaths = req.body.paths;
  const force = req.body.force || false;
  const maxPoolSize = os.cpus().length;
  const poolSize = Math.max(1, Math.min(req.body.poolSize || (maxPoolSize - 1 || 1), maxPoolSize));

  if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length === 0) {
    return res.status(400).json({ error: '缺少 paths 参数或为空数组' });
  }

  const semaphore = getSpriteSemaphore();
  const batchIsRunning = getBatchThreadPool() && getBatchThreadPool().isRunning === true;

  if (semaphore.getActiveCount() > 0 || semaphore.getQueueLength() > 0 || batchIsRunning) {
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
  const batchThreadPool = new SpriteThreadPool({ poolSize });
  setBatchThreadPool(batchThreadPool);
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
    setBatchThreadPool(null);
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
router.get('/batch-status', (req, res) => {
  const batchThreadPool = getBatchThreadPool();
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

// API: 中止单个视频的雪碧图生成（支持任务ID或视频路径）
router.post('/abort', (req, res) => {
  const taskIdOrPath = req.body.taskId || req.body.path;
  if (!taskIdOrPath) {
    return res.status(400).json({ error: '缺少 taskId 或 path 参数' });
  }

  const semaphore = getSpriteSemaphore();
  const success = semaphore.abort(taskIdOrPath);

  if (success) {
    res.json({ success: true, message: '已发送中止信号' });
  } else {
    res.json({ success: false, message: '未找到可中止的任务' });
  }
});

// API: 中止批量生成
router.post('/batch-abort', (req, res) => {
  const batchThreadPool = getBatchThreadPool();
  if (!batchThreadPool || !batchThreadPool.isRunning) {
    return res.json({ success: false, message: '没有正在进行的批量生成' });
  }

  batchThreadPool.abort();
  res.json({ success: true, message: '已发送中止信号' });
});

// API: 清除所有已完成的历史任务
router.post('/clear-history', (req, res) => {
  const semaphore = getSpriteSemaphore();
  semaphore.clearCompletedTasks();
  res.json({ success: true, message: '已清除历史任务' });
});

module.exports = router;
