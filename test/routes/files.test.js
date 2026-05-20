const request = require('supertest');

// 在引入 app 之前先 mock 所有依赖
jest.mock('fs');
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
jest.mock('../../server/middleware/path', () => ({
  isPathAllowed: jest.fn().mockReturnValue(true),
  normalizePath: jest.fn(p => p)
}));
jest.mock('../../server/utils', () => ({
  getVideoMimeType: jest.fn().mockReturnValue('video/mp4'),
  safeOpen: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../scanner/spriteGenerator', () => ({
  checkFFmpeg: jest.fn().mockResolvedValue({ available: true, path: '/usr/bin/ffmpeg' })
}));
jest.mock('../../scanner/config', () => ({
  outputPath: '/test/data/videos.json'
}));

describe('Files Routes', () => {
  let app;
  let mockFs;
  let mockUtils;
  let mockPath;

  beforeEach(() => {
    jest.resetAllMocks();

    mockFs = require('fs');
    mockUtils = require('../../server/utils');
    mockPath = require('../../server/middleware/path');

    // 模拟 fs - 不模拟 createReadStream 会导致超时
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ size: 100 * 1024 * 1024, isDirectory: jest.fn().mockReturnValue(false) });

    // 重新引入 app
    const { createApp } = require('../../server/app');
    app = createApp();
  });

  describe('GET /api/video', () => {
    test('应该返回 400 如果缺少 path 参数', async () => {
      const response = await request(app).get('/api/video');
      expect(response.status).toBe(400);
    });

    test('应该返回 403 如果路径不允许', async () => {
      mockPath.isPathAllowed.mockReturnValue(false);
      const response = await request(app).get('/api/video?path=/forbidden.mp4');
      expect(response.status).toBe(403);
    });

    test('应该返回 404 如果文件不存在', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const response = await request(app).get('/api/video?path=/nonexistent.mp4');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/image', () => {
    test('应该返回 400 如果缺少 path 参数', async () => {
      const response = await request(app).get('/api/image');
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/open-video', () => {
    test('应该返回 400 如果缺少 path 参数', async () => {
      const response = await request(app).post('/api/open-video');
      expect(response.status).toBe(400);
    });

    test('应该成功打开视频', async () => {
      const response = await request(app).post('/api/open-video').send({ path: '/test.mp4' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('即使打开失败也应该返回success', async () => {
      mockUtils.safeOpen.mockRejectedValue(new Error('Open error'));
      const response = await request(app).post('/api/open-video').send({ path: '/test.mp4' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/open-directory', () => {
    test('应该成功打开目录', async () => {
      const response = await request(app).post('/api/open-directory').send({ path: '/test' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/ffmpeg/status', () => {
    test('应该返回 FFmpeg 状态', async () => {
      const response = await request(app).get('/api/ffmpeg/status');
      expect(response.status).toBe(200);
    });

    test('应该返回错误状态当检查失败', async () => {
      const spriteGenerator = require('../../scanner/spriteGenerator');
      spriteGenerator.checkFFmpeg.mockRejectedValue(new Error('Check error'));
      const response = await request(app).get('/api/ffmpeg/status');
      expect(response.status).toBe(200);
      expect(response.body.available).toBe(false);
    });
  });

  describe('POST /api/delete-directory', () => {
    test('应该返回 400 如果缺少 path 参数', async () => {
      const response = await request(app).post('/api/delete-directory');
      expect(response.status).toBe(400);
    });

    test('应该返回 429 如果超过速率限制', async () => {
      // 先发送3次删除请求
      await request(app).post('/api/delete-directory').send({ path: '/test1' });
      await request(app).post('/api/delete-directory').send({ path: '/test2' });
      await request(app).post('/api/delete-directory').send({ path: '/test3' });

      // 第4次应该被限制
      const response = await request(app).post('/api/delete-directory').send({ path: '/test4' });
      expect(response.status).toBe(429);
    });

    test('应该返回 404 如果目录不存在', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const response = await request(app).post('/api/delete-directory').send({ path: '/nonexistent' });
      expect(response.status).toBe(404);
    });
  });
});
