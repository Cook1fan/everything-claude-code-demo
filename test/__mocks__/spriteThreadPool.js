class MockSpriteThreadPool {
  constructor(options = {}) {
    this.options = options;
    this.isRunning = false;
    this.videos = [];
    this.listeners = {};
  }

  addVideos(videos, options = {}) {
    this.videos = videos;
  }

  start() {
    this.isRunning = true;
    this.emit('start', { total: this.videos.length });
  }

  abort() {
    this.isRunning = false;
  }

  getStats() {
    return {
      total: this.videos.length,
      completed: 0,
      failed: 0
    };
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

module.exports = MockSpriteThreadPool;
