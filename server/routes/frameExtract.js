const express = require('express');
const path = require('path');
const fs = require('fs');
const { checkFFmpeg } = require('../../scanner/frameExtractor');
const { frameTaskSemaphore } = require('../../scanner/FrameTaskSemaphore');
const config = require('../../scanner/config');
const { isPathAllowed, normalizePath } = require('../middleware/path');
const { getVideoIdByPath, getVideoTitleByPath } = require('../middleware/video-info');
const { broadcastFrameExtractStatus } = require('../websocket');

const router = express.Router();

// API: Start frame extraction task
router.post('/start', async (req, res) => {
  const { videoPath, params } = req.body;

  if (!videoPath) {
    return res.status(400).json({ error: 'Missing videoPath parameter' });
  }

  if (!params) {
    return res.status(400).json({ error: 'Missing params parameter' });
  }

  // Validate params
  const { startTime = 0, endTime, interval = 1, quality = 3, outputWidth = -1, outputHeight = -1, format = 'jpg', outputDir = '' } = params;
  if (endTime === undefined || endTime <= startTime) {
    return res.status(400).json({ error: 'Invalid endTime - must be greater than startTime' });
  }
  if (interval <= 0) {
    return res.status(400).json({ error: 'Invalid interval - must be greater than 0' });
  }
  if (quality < 1 || quality > 31) {
    return res.status(400).json({ error: 'Invalid quality - must be between 1 and 31' });
  }

  const resolvedPath = path.resolve(videoPath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  // Check FFmpeg
  const ffmpegStatus = await checkFFmpeg();
  if (!ffmpegStatus.available) {
    return res.json({
      success: false,
      message: ffmpegStatus.message || 'FFmpeg not available'
    });
  }

  // Add task to semaphore
  const taskId = frameTaskSemaphore.addTask(
    resolvedPath,
    { startTime, endTime, interval, quality, outputWidth, outputHeight, format, outputDir },
    getVideoIdByPath(resolvedPath),
    getVideoTitleByPath(resolvedPath)
  );

  // Cleanup old tasks
  frameTaskSemaphore.clearHistory(config.frameExtract?.maxCompletedTasks || 20);

  const task = frameTaskSemaphore.getTask(taskId);
  res.json({
    success: true,
    message: 'Frame extraction task started',
    taskId,
    task
  });
});

// API: Get all task statuses
router.get('/status', (req, res) => {
  const allTasks = frameTaskSemaphore.getAllTasks();

  // Cleanup old tasks before returning
  frameTaskSemaphore.clearHistory(config.frameExtract?.maxCompletedTasks || 20);

  res.json({
    inProgress: frameTaskSemaphore.getActiveCount() > 0,
    tasks: allTasks
  });
});

// API: Get single task status
router.get('/status/:taskId', (req, res) => {
  const task = frameTaskSemaphore.getTask(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// API: Abort a task
router.post('/abort', (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return res.status(400).json({ error: 'Missing taskId parameter' });
  }

  const result = frameTaskSemaphore.abortTask(taskId);
  res.json(result);
});

// API: Download extracted frames (ZIP)
router.get('/download/:taskId', (req, res) => {
  const task = frameTaskSemaphore.getTask(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.status !== 'completed') {
    return res.status(400).json({ error: 'Task not completed' });
  }

  if (!task.outputPath || !fs.existsSync(task.outputPath)) {
    return res.status(404).json({ error: 'ZIP file not found' });
  }

  // Set headers for download - encode filename to handle special characters
  res.setHeader('Content-Type', 'application/zip');
  const filename = task.outputFileName || 'frames.zip';
  const encodedFilename = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);

  // Stream the file
  const fileStream = fs.createReadStream(task.outputPath);
  fileStream.pipe(res);
});

// API: Preview a single frame (if available)
router.get('/preview/:taskId/:frameIndex', (req, res) => {
  const task = frameTaskSemaphore.getTask(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // For now, we don't keep individual frames after ZIP packaging
  // This could be extended if we want to keep frames for preview
  res.status(501).json({ error: 'Frame preview not implemented yet' });
});

// API: Clear completed/aborted/errored tasks from history
router.post('/clear-history', (req, res) => {
  const keepLast = parseInt(req.body.keepLast) || 20;
  const result = frameTaskSemaphore.clearHistory(keepLast);
  res.json({ success: true, ...result });
});

// Register event listeners for WebSocket broadcasting
frameTaskSemaphore.on('taskAdded', ({ taskId, task }) => {
  broadcastFrameExtractStatus(taskId, task, 'added');
});

frameTaskSemaphore.on('taskStarted', ({ taskId, task }) => {
  broadcastFrameExtractStatus(taskId, task, 'started');
});

frameTaskSemaphore.on('progress', ({ taskId, task, progress }) => {
  broadcastFrameExtractStatus(taskId, task, 'progress');
});

frameTaskSemaphore.on('statusUpdate', ({ taskId, task }) => {
  broadcastFrameExtractStatus(taskId, task, 'status');
});

frameTaskSemaphore.on('taskCompleted', ({ taskId, task, result }) => {
  broadcastFrameExtractStatus(taskId, task, 'completed');
});

frameTaskSemaphore.on('taskError', ({ taskId, task, error }) => {
  broadcastFrameExtractStatus(taskId, task, 'error');
});

module.exports = router;
