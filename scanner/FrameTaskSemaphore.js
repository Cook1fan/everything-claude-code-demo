const EventEmitter = require('events');
const { extractFrames, abortFrameExtract } = require('./frameExtractor');
const path = require('path');

class FrameTaskSemaphore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrent = options.maxConcurrent || 2; // 默认最多2个并发任务
    this.tasks = new Map(); // taskId -> task
    this.queue = []; // 排队的任务
    this.activeCount = 0;
    this.taskIdCounter = 0;
  }

  generateTaskId() {
    return `frame-task-${Date.now()}-${++this.taskIdCounter}`;
  }

  /**
   * Add a new frame extraction task
   * @param {string} videoPath - Path to video file
   * @param {object} params - Extraction parameters
   * @param {string} videoId - Optional video ID
   * @param {string} videoTitle - Optional video title
   * @returns {string} taskId
   */
  addTask(videoPath, params, videoId = null, videoTitle = null) {
    const taskId = this.generateTaskId();
    const task = {
      id: taskId,
      videoPath,
      videoId,
      videoTitle: videoTitle || path.basename(videoPath),
      params,
      status: 'pending',
      stage: null,
      message: 'Queued',
      percent: 0,
      totalFrames: 0,
      extractedFrames: 0,
      error: false,
      errorMessage: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      outputPath: null,
      outputFileName: null,
      frameFiles: null,
      totalTime: null,
      abortController: null
    };

    this.tasks.set(taskId, task);
    this.queue.push(taskId);

    this.emit('taskAdded', { taskId, task });
    this.processQueue();

    return taskId;
  }

  /**
   * Process the queue
   */
  processQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const taskId = this.queue.shift();
      this.startTask(taskId);
    }
  }

  /**
   * Start a task
   * @param {string} taskId
   */
  async startTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.activeCount++;
    task.status = 'running';
    task.stage = 'starting';
    task.message = 'Starting...';
    task.updatedAt = Date.now();

    const abortController = new AbortController();
    task.abortController = abortController;

    this.emit('taskStarted', { taskId, task });
    this.emit('statusUpdate', { taskId, task });

    try {
      const result = await extractFrames(
        task.videoPath,
        task.params,
        (progress) => {
          // Update task with progress
          task.stage = progress.stage || task.stage;
          task.message = progress.message || task.message;
          task.percent = progress.percent ?? task.percent;
          task.totalFrames = progress.totalFrames ?? task.totalFrames;
          task.extractedFrames = progress.extractedFrames ?? task.extractedFrames;
          task.updatedAt = Date.now();

          this.emit('progress', { taskId, task, progress });
          this.emit('statusUpdate', { taskId, task });
        },
        abortController
      );

      // Task completed successfully
      task.status = 'completed';
      task.stage = 'complete';
      task.message = 'Complete!';
      task.percent = 100;
      task.outputPath = result.outputPath;  // 直接使用返回的 outputPath
      task.outputFileName = result.outputFileName;
      task.frameCount = result.frameCount;
      task.totalTime = result.totalTime;
      task.updatedAt = Date.now();

      this.emit('taskCompleted', { taskId, task, result });
      this.emit('statusUpdate', { taskId, task });
    } catch (error) {
      // Task failed or was aborted
      if (abortController.signal.aborted) {
        task.status = 'aborted';
        task.message = 'Aborted';
      } else {
        task.status = 'error';
        task.error = true;
        task.errorMessage = error.message;
        task.message = `Error: ${error.message}`;
      }
      task.updatedAt = Date.now();

      this.emit('taskError', { taskId, task, error: error.message });
      this.emit('statusUpdate', { taskId, task });
    } finally {
      this.activeCount--;
      task.abortController = null;
      this.processQueue();
    }
  }

  /**
   * Abort a running task
   * @param {string} taskId
   */
  abortTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    if (task.status === 'pending') {
      // Remove from queue
      const index = this.queue.indexOf(taskId);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      task.status = 'aborted';
      task.message = 'Aborted';
      task.updatedAt = Date.now();
      this.emit('statusUpdate', { taskId, task });
      return { success: true, message: 'Task removed from queue' };
    }

    if (task.status !== 'running') {
      return { success: false, message: 'Task is not running' };
    }

    if (task.abortController) {
      task.abortController.abort();
    }

    return { success: true, message: 'Abort signal sent' };
  }

  /**
   * Get task status
   * @param {string} taskId
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all tasks
   */
  getAllTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get active tasks count
   */
  getActiveCount() {
    return this.activeCount;
  }

  /**
   * Get queue length
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * Clear completed/aborted/errored tasks
   */
  clearHistory(keepLast = 20) {
    const allTasks = this.getAllTasks();
    const toRemove = allTasks.filter(t => ['completed', 'aborted', 'error'].includes(t.status)).slice(keepLast);

    for (const task of toRemove) {
      this.tasks.delete(task.id);
    }

    return { removed: toRemove.length };
  }
}

// Create singleton instance
const frameTaskSemaphore = new FrameTaskSemaphore();

module.exports = {
  FrameTaskSemaphore,
  frameTaskSemaphore
};
