const request = require('supertest');

// 在引入 app 之前先 mock 所有依赖
jest.mock('fs');
jest.mock('worker_threads', () => ({
  Worker: jest.fn().mockImplementation(function() {
    this.on = jest.fn();
    this.terminate = jest.fn();
    return this;
  })
}));
jest.mock('../../server/websocket', () => ({
  initWebSocket: jest.fn(),
  broadcastScanStatus: jest.fn(),
  getSpriteSemaphore: jest.fn().mockReturnValue({
    isVideoInQueueOrRunning: jest.fn(),
    cleanupOldStatuses: jest.fn(),
    getAllStatuses: jest.fn().mockReturnValue([]),
    getActiveCount: jest.fn().mockReturnValue(0),
    getQueueLength: jest.fn().mockReturnValue(0)
  }),
  getBatchThreadPool: jest.fn(),
  setBatchThreadPool: jest.fn(),
  broadcastBatchSpriteStatus: jest.fn()
}));
jest.mock('../../server/middleware/cache', () => ({
  getVideoData: jest.fn(),
  clearVideoDataCache: jest.fn()
}));
jest.mock('../../server/middleware/video-info', () => ({
  clearVideoInfoCache: jest.fn()
}));
jest.mock('../../scanner/config', () => ({
  outputPath: '/test/data/videos.json'
}));

describe('Scan Routes', () => {
  let app;
  let mockFs;

  beforeEach(() => {
    jest.resetAllMocks();
    mockFs = require('fs');
    // 重新引入 app
    const { createApp } = require('../../server/app');
    app = createApp();
  });

  describe('POST /api/scan', () => {
    test('应该成功启动扫描', async () => {
      const response = await request(app).post('/api/scan');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('应该拒绝并发扫描', async () => {
      // 第一次扫描
      await request(app).post('/api/scan');

      // 第二次扫描
      const response = await request(app).post('/api/scan');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/scan/status', () => {
    test('应该返回扫描状态', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        videos: [{ id: '1' }],
        generatedAt: Date.now()
      }));

      const response = await request(app).get('/api/scan/status');

      expect(response.status).toBe(200);
      expect(response.body.scanning).toBeDefined();
      expect(response.body.videoCount).toBe(1);
    });

    test('应该处理读取状态失败', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const response = await request(app).get('/api/scan/status');

      expect(response.status).toBe(200);
      expect(response.body.videoCount).toBe(0);
    });
  });
});
