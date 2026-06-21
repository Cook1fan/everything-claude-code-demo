const request = require('supertest');
const path = require('path');

// 在引入 app 之前先 mock 依赖
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

describe('Deletion Records Routes', () => {
  let app;
  let mockFs;
  let mockPath;

  beforeEach(() => {
    jest.resetAllMocks();

    mockFs = require('fs');
    mockPath = require('../../server/middleware/path');

    mockPath.isPathAllowed.mockReturnValue(true);

    // 重新引入 app
    const { createApp } = require('../../server/app');
    app = createApp();
  });

  describe('GET /api/deletion-records', () => {
    test('应该返回 400 如果缺少 path 参数', async () => {
      const response = await request(app).get('/api/deletion-records');
      expect(response.status).toBe(400);
    });

    test('应该返回 403 如果路径不允许', async () => {
      mockPath.isPathAllowed.mockReturnValue(false);
      const response = await request(app).get('/api/deletion-records?path=/forbidden');
      expect(response.status).toBe(403);
    });

    test('应该返回 404 如果目录不存在', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const response = await request(app).get('/api/deletion-records?path=/nonexistent');
      expect(response.status).toBe(404);
    });

    test('应该返回 400 如果路径不是目录', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(false)
      });
      const response = await request(app).get('/api/deletion-records?path=/somefile.txt');
      expect(response.status).toBe(400);
    });

    test('应该返回 exists:false 当 deleted_video_dirs.txt 不存在', async () => {
      // 第一次 existsSync: 目录存在;第二次: 文件不存在
      mockFs.existsSync
        .mockReturnValueOnce(true)  // 目录
        .mockReturnValueOnce(false); // 记录文件
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ exists: false, records: [] });
    });

    test('应该返回按时间戳降序的记录列表', async () => {
      const fileContent = [
        '[2025-01-15T10:00:00.000Z] /path/to/first',
        '[2025-12-18T14:30:25.000Z] /path/to/second',
        '[2025-06-10T08:15:30.000Z] /path/to/third',
        ''
      ].join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue(fileContent);

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(response.body.records).toHaveLength(3);
      expect(response.body.records[0]).toEqual({
        timestamp: '2025-12-18T14:30:25.000Z',
        path: '/path/to/second'
      });
      expect(response.body.records[1].timestamp).toBe('2025-06-10T08:15:30.000Z');
      expect(response.body.records[2].timestamp).toBe('2025-01-15T10:00:00.000Z');
    });

    test('应该跳过空行', async () => {
      const fileContent = [
        '[2025-01-15T10:00:00.000Z] /path/to/first',
        '',
        '   ',
        '[2025-12-18T14:30:25.000Z] /path/to/second',
        ''
      ].join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue(fileContent);

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.body.records).toHaveLength(2);
    });

    test('应该跳过解析失败的行', async () => {
      const fileContent = [
        '[2025-01-15T10:00:00.000Z] /path/to/first',
        'this is not a valid line',
        '[invalid timestamp] /path/to/broken',
        '[2025-12-18T14:30:25.000Z] /path/to/second'
      ].join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue(fileContent);

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.body.records).toHaveLength(2);
      // 第二条记录在降序中排第二
      expect(response.body.records[1].path).toBe('/path/to/first');
    });

    test('应该返回空数组当文件只有空行', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockReturnValue('\n\n   \n');

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(response.body.records).toEqual([]);
    });

    test('应该返回 500 当文件读取失败', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true)
      });
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('disk error');
      });

      const response = await request(app).get('/api/deletion-records?path=/some/dir');
      expect(response.status).toBe(500);
    });
  });
});
