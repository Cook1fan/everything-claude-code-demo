const request = require('supertest');

// 在引入 app 之前先 mock 所有依赖
jest.mock('fs');
jest.mock('../../server/websocket', () => {
  const mockSemaphore = {
    isVideoInQueueOrRunning: jest.fn().mockReturnValue(false),
    cleanupOldStatuses: jest.fn(),
    submit: jest.fn().mockReturnValue('test-task-id'),
    getStatusByVideoPath: jest.fn().mockReturnValue({}),
    getAllStatuses: jest.fn().mockReturnValue([]),
    getActiveCount: jest.fn().mockReturnValue(0),
    getQueueLength: jest.fn().mockReturnValue(0),
    abort: jest.fn().mockReturnValue(true),
    clearCompletedTasks: jest.fn(),
    on: jest.fn()
  };
  return {
    initWebSocket: jest.fn(),
    broadcastScanStatus: jest.fn(),
    getSpriteSemaphore: jest.fn().mockReturnValue(mockSemaphore),
    getBatchThreadPool: jest.fn().mockReturnValue(null),
    setBatchThreadPool: jest.fn(),
    broadcastBatchSpriteStatus: jest.fn()
  };
});
jest.mock('../../server/middleware/cache', () => ({
  getVideoData: jest.fn(),
  clearVideoDataCache: jest.fn()
}));
jest.mock('../../server/middleware/path', () => ({
  isPathAllowed: jest.fn().mockReturnValue(true),
  normalizePath: jest.fn(p => p)
}));
jest.mock('../../server/middleware/video-info', () => ({
  getVideoIdByPath: jest.fn().mockReturnValue('test-id'),
  getVideoTitleByPath: jest.fn().mockReturnValue('测试视频')
}));
jest.mock('../../scanner/spriteGenerator', () => ({
  checkFFmpeg: jest.fn().mockResolvedValue({ available: true, path: '/usr/bin/ffmpeg' }),
  generateSprite: jest.fn().mockResolvedValue({ spritePath: '/test/video.jpg' }),
  abortSpriteGeneration: jest.fn()
}));
jest.mock('../../scanner/spriteThreadPool', () => {
  return jest.fn().mockImplementation(function() {
    this.isRunning = false;
    this.addVideos = jest.fn();
    this.start = jest.fn();
    this.abort = jest.fn();
    this.getStats = jest.fn().mockReturnValue({ total: 0 });
    this.on = jest.fn();
    return this;
  });
});
jest.mock('../../scanner/config', () => ({
  outputPath: '/test/data/videos.json'
}));

describe('Sprite Routes', () => {
  let app;
  let mockSpriteGenerator;
  let mockWebSocket;
  let mockPath;
  let mockFs;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    mockSpriteGenerator = require('../../scanner/spriteGenerator');
    mockWebSocket = require('../../server/websocket');
    mockPath = require('../../server/middleware/path');
    mockFs = require('fs');

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ videos: [] }));

    // 重新引入 app
    const { createApp } = require('../../server/app');
    app = createApp();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('POST /api/sprite/generate', () => {
    test('应该返回 400 如果 path 参数缺失', async () => {
      const response = await request(app).post('/api/sprite/generate').send({});
      expect(response.status).toBe(400);
    });

    test('应该返回 403 如果路径不允许', async () => {
      mockPath.isPathAllowed.mockReturnValue(false);
      const response = await request(app).post('/api/sprite/generate').send({ path: '/forbidden.mp4' });
      expect(response.status).toBe(403);
    });

    test('应该返回 404 如果文件不存在', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const response = await request(app).post('/api/sprite/generate').send({ path: '/nonexistent.mp4' });
      expect(response.status).toBe(404);
    });

    test('应该返回失败当 FFmpeg 不可用', async () => {
      mockSpriteGenerator.checkFFmpeg.mockResolvedValue({ available: false, message: 'FFmpeg not found' });
      const response = await request(app).post('/api/sprite/generate').send({ path: '/test.mp4' });
      expect(response.body.success).toBe(false);
    });

    test('应该返回失败当视频已在队列中', async () => {
      const semaphore = mockWebSocket.getSpriteSemaphore();
      semaphore.isVideoInQueueOrRunning.mockReturnValue(true);
      const response = await request(app).post('/api/sprite/generate').send({ path: '/test.mp4' });
      expect(response.body.success).toBe(false);
    });

    test('应该成功提交生成任务', async () => {
      const response = await request(app).post('/api/sprite/generate').send({ path: '/test.mp4' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.taskId).toBe('test-task-id');
    });
  });

  describe('GET /api/sprite/status', () => {
    test('应该返回雪碧图生成状态', async () => {
      const response = await request(app).get('/api/sprite/status');
      expect(response.status).toBe(200);
      expect(response.body.inProgress).toBeDefined();
    });
  });

  describe('GET /api/sprite/info', () => {
    test('应该返回 400 如果 path 参数缺失', async () => {
      const response = await request(app).get('/api/sprite/info');
      expect(response.status).toBe(400);
    });

    test('应该返回 403 如果路径不允许', async () => {
      mockPath.isPathAllowed.mockReturnValue(false);
      const response = await request(app).get('/api/sprite/info?path=/forbidden.jpg');
      expect(response.status).toBe(403);
    });

    test('应该返回 404 如果信息文件不存在', async () => {
      mockFs.existsSync.mockImplementation((path) => !path.includes('.json'));
      const response = await request(app).get('/api/sprite/info?path=/test.jpg');
      expect(response.status).toBe(404);
    });

    test('应该返回雪碧图信息', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ thumbnailCount: 10 }));
      const response = await request(app).get('/api/sprite/info?path=/test.jpg');
      expect(response.status).toBe(200);
    });

    test('应该返回 500 如果读取失败', async () => {
      mockFs.readFileSync.mockImplementation(() => { throw new Error('Read error'); });
      const response = await request(app).get('/api/sprite/info?path=/test.jpg');
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/sprite/batch-generate', () => {
    test('应该返回 400 如果 paths 参数缺失', async () => {
      const response = await request(app).post('/api/sprite/batch-generate').send({});
      expect(response.status).toBe(400);
    });

    test('应该返回失败当其他任务正在进行', async () => {
      const semaphore = mockWebSocket.getSpriteSemaphore();
      semaphore.getActiveCount.mockReturnValue(1);
      const response = await request(app).post('/api/sprite/batch-generate').send({ paths: ['/test.mp4'] });
      expect(response.body.success).toBe(false);
    });

    test('应该返回失败当 FFmpeg 不可用', async () => {
      mockSpriteGenerator.checkFFmpeg.mockResolvedValue({ available: false });
      const response = await request(app).post('/api/sprite/batch-generate').send({ paths: ['/test.mp4'] });
      expect(response.body.success).toBe(false);
    });

    test('应该返回失败当没有有效视频', async () => {
      mockPath.isPathAllowed.mockReturnValue(false);
      const response = await request(app).post('/api/sprite/batch-generate').send({ paths: ['/test.mp4'] });
      expect(response.body.success).toBe(false);
    });

    test('应该成功启动批量生成', async () => {
      const response = await request(app).post('/api/sprite/batch-generate').send({ paths: ['/test.mp4'] });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/sprite/batch-status', () => {
    test('应该返回批量状态', async () => {
      const response = await request(app).get('/api/sprite/batch-status');
      expect(response.status).toBe(200);
    });

    test('应该返回运行中的线程池状态', async () => {
      mockWebSocket.getBatchThreadPool.mockReturnValue({
        isRunning: true,
        getStats: jest.fn().mockReturnValue({ total: 5 })
      });
      const response = await request(app).get('/api/sprite/batch-status');
      expect(response.body.isRunning).toBe(true);
    });
  });

  describe('POST /api/sprite/abort', () => {
    test('应该返回 400 如果没有参数', async () => {
      const response = await request(app).post('/api/sprite/abort').send({});
      expect(response.status).toBe(400);
    });

    test('应该成功发送中止信号', async () => {
      const response = await request(app).post('/api/sprite/abort').send({ taskId: 'test-id' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/sprite/batch-abort', () => {
    test('应该返回失败当没有运行中的任务', async () => {
      const response = await request(app).post('/api/sprite/batch-abort');
      expect(response.body.success).toBe(false);
    });

    test('应该成功中止批量任务', async () => {
      const mockPool = { isRunning: true, abort: jest.fn() };
      mockWebSocket.getBatchThreadPool.mockReturnValue(mockPool);
      const response = await request(app).post('/api/sprite/batch-abort');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPool.abort).toHaveBeenCalled();
    });
  });

  describe('POST /api/sprite/clear-history', () => {
    test('应该清除历史记录', async () => {
      const response = await request(app).post('/api/sprite/clear-history');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const semaphore = mockWebSocket.getSpriteSemaphore();
      expect(semaphore.clearCompletedTasks).toHaveBeenCalled();
    });
  });
});
