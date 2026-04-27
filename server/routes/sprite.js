const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { checkFFmpeg, generateSprite } = require('../../scanner/spriteGenerator');
const SpriteThreadPool = require('../../scanner/spriteThreadPool');
const config = require('../../scanner/config');
const { isPathAllowed, normalizePath } = require('../middleware/path');
const { getVideoData, clearVideoDataCache } = require('../middleware/cache');
const { getVideoIdByPath, getVideoTitleByPath } = require('../middleware/video-info');
const {
  getSpriteGenerationInProgressSet,
  getSpriteGenerationStatusMap,
  getBatchThreadPool,
  setBatchThreadPool,
  broadcastSpriteStatus,
  broadcastBatchSpriteStatus
} = require('../websocket');

const router = express.Router();

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

// API: 生成雪碧图（支持多个同时生成）
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

  const spriteGenerationInProgressSet = getSpriteGenerationInProgressSet();
  const spriteGenerationStatusMap = getSpriteGenerationStatusMap();

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
        const videoIndex = data.videos.findIndex(v => normalizePath(v.videoPath) === normalizePath(resolvedPath));
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
router.get('/status', (req, res) => {
  const allStatus = Array.from(getSpriteGenerationStatusMap().values()).map(status => ({
    ...status,
    videoTitle: status.videoTitle || (status.videoPath ? getVideoTitleByPath(status.videoPath) : undefined)
  }));
  res.json({
    inProgress: getSpriteGenerationInProgressSet().size > 0,
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
  // 限制线程池大小：至少1个，最多CPU核心数
  const maxPoolSize = os.cpus().length;
  const poolSize = Math.max(1, Math.min(req.body.poolSize || (maxPoolSize - 1 || 1), maxPoolSize));

  if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length === 0) {
    return res.status(400).json({ error: '缺少 paths 参数或为空数组' });
  }

  const batchIsRunning = getBatchThreadPool() && getBatchThreadPool().isRunning === true;
  if (getSpriteGenerationInProgressSet().size > 0 || batchIsRunning) {
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

// API: 中止批量生成
router.post('/batch-abort', (req, res) => {
  const batchThreadPool = getBatchThreadPool();
  if (!batchThreadPool || !batchThreadPool.isRunning) {
    return res.json({ success: false, message: '没有正在进行的批量生成' });
  }

  batchThreadPool.abort();
  res.json({ success: true, message: '已发送中止信号' });
});

module.exports = router;
