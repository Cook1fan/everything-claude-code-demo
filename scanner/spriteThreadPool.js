const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

class SpriteThreadPool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.poolSize = options.poolSize || Math.max(1, os.cpus().length - 1);
    this.videoPaths = [];
    this.results = [];
    this.activeWorkers = 0;
    this.taskIndex = 0;
    this.isRunning = false;
    this.aborted = false;
    this.workerPath = path.join(__dirname, 'spriteWorker.js');
  }

  addVideo(videoPath, options = {}) {
    this.videoPaths.push({ videoPath, options });
  }

  addVideos(videoPathsArray, options = {}) {
    videoPathsArray.forEach(videoPath => this.addVideo(videoPath, options));
  }

  getStats() {
    return {
      total: this.videoPaths.length,
      completed: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      active: this.activeWorkers,
      pending: this.videoPaths.length - this.results.length - this.activeWorkers,
      isRunning: this.isRunning,
      aborted: this.aborted
    };
  }

  async start() {
    if (this.isRunning) {
      throw new Error('ThreadPool is already running');
    }

    this.isRunning = true;
    this.aborted = false;
    this.results = [];
    this.taskIndex = 0;

    console.log('[ThreadPool] 启动线程池，大小:', this.poolSize);
    console.log('[ThreadPool] 待处理视频数:', this.videoPaths.length);

    this.emit('start', { total: this.videoPaths.length, poolSize: this.poolSize });

    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker();
    }

    return new Promise((resolve) => {
      const checkDone = () => {
        if (this.activeWorkers === 0 || this.aborted) {
          this.isRunning = false;
          this.emit('done', { results: this.results, stats: this.getStats() });
          resolve({ results: this.results, stats: this.getStats() });
        }
      };

      const interval = setInterval(() => {
        if (this.activeWorkers === 0 || this.aborted) {
          clearInterval(interval);
          checkDone();
        }
      }, 100);
    });
  }

  abort() {
    this.aborted = true;
    this.emit('abort');
  }

  createWorker() {
    if (this.aborted) return;
    if (this.taskIndex >= this.videoPaths.length) return;
    if (this.activeWorkers >= this.poolSize) return;

    const task = this.videoPaths[this.taskIndex++];
    this.activeWorkers++;

    console.log('[ThreadPool] 创建 Worker 处理:', path.basename(task.videoPath));

    const worker = new Worker(this.workerPath, {
      workerData: {
        videoPath: task.videoPath,
        options: task.options
      }
    });

    worker.on('message', (message) => {
      this.handleWorkerMessage(worker, task.videoPath, message);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(worker, task.videoPath, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(worker, task.videoPath, code);
    });
  }

  handleWorkerMessage(worker, videoPath, message) {
    if (message.type === 'progress') {
      this.emit('progress', {
        videoPath,
        ...message
      });
    } else if (message.type === 'complete') {
      this.results.push({
        videoPath,
        success: true,
        ...message
      });
      this.emit('videoComplete', {
        videoPath,
        success: true,
        ...message
      });
    } else if (message.type === 'error') {
      this.results.push({
        videoPath,
        success: false,
        error: message.error
      });
      this.emit('videoError', {
        videoPath,
        success: false,
        error: message.error
      });
    }
  }

  handleWorkerError(worker, videoPath, error) {
    console.error('[ThreadPool] Worker 错误:', path.basename(videoPath), error.message);
    const existing = this.results.find(r => r.videoPath === videoPath);
    if (!existing) {
      this.results.push({
        videoPath,
        success: false,
        error: error.message
      });
    }
    this.activeWorkers--;
    this.createWorker();
  }

  handleWorkerExit(worker, videoPath, code) {
    if (code !== 0) {
      console.error('[ThreadPool] Worker 异常退出:', path.basename(videoPath), '退出码:', code);
    }
    this.activeWorkers--;
    this.createWorker();
  }
}

module.exports = SpriteThreadPool;
