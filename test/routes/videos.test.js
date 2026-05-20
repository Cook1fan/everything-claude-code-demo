const request = require('supertest');

// 在引入 app 之前先 mock 所有依赖
jest.mock('fs');
jest.mock('../../server/middleware/cache', () => ({
  getVideoData: jest.fn(),
  clearVideoDataCache: jest.fn()
}));
jest.mock('../../server/utils', () => ({
  ensureDataFile: jest.fn()
}));
jest.mock('../../scanner/config', () => ({
  outputPath: '/test/data/videos.json'
}));

describe('Videos Routes', () => {
  let app;
  let mockCache;
  let mockFs;

  beforeEach(() => {
    jest.resetAllMocks();

    mockFs = require('fs');
    mockCache = require('../../server/middleware/cache');

    // 重新引入 app
    const { createApp } = require('../../server/app');
    app = createApp();
  });

  describe('GET /api/videos', () => {
    test('应该成功返回视频列表', async () => {
      const testData = {
        videos: [
          {
            id: 'test-1',
            title: '测试视频 1',
            videoPath: '/test/video1.mp4',
            directory: '/test',
            hardDrive: '/'
          }
        ],
        directories: ['/test'],
        hardDrives: ['/'],
        generatedAt: Date.now()
      };

      mockCache.getVideoData.mockReturnValue(null);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const response = await request(app).get('/api/videos');

      expect(response.status).toBe(200);
      expect(response.body.videos).toHaveLength(1);
      expect(response.body.videos[0].title).toBe('测试视频 1');
    });

    test('应该为有spritePath的视频添加spriteVttPath', async () => {
      const testData = {
        videos: [
          {
            id: 'test-1',
            title: '测试视频 1',
            videoPath: '/test/video1.mp4',
            spritePath: '/test/sprite.jpg'
          }
        ],
        directories: ['/test'],
        hardDrives: ['/']
      };

      mockCache.getVideoData.mockReturnValue(null);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const response = await request(app).get('/api/videos');

      expect(response.status).toBe(200);
      expect(response.body.videos[0].spriteVttPath).toBe('/test/sprite.vtt');
    });

    test('应该支持分页', async () => {
      const testData = {
        videos: Array.from({ length: 25 }, (_, i) => ({
          id: `test-${i}`,
          title: `测试视频 ${i}`,
          videoPath: `/test/video${i}.mp4`
        })),
        directories: ['/test'],
        hardDrives: ['/']
      };

      mockCache.getVideoData.mockReturnValue(null);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const response = await request(app).get('/api/videos?page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.videos).toHaveLength(10);
      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      });
    });

    test('应该返回500错误当读取失败', async () => {
      mockCache.getVideoData.mockReturnValue(null);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const response = await request(app).get('/api/videos');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('读取数据失败');
    });

    test('应该使用缓存数据', async () => {
      const testData = {
        videos: [{ id: 'test-1', title: '缓存视频' }],
        directories: ['/test'],
        hardDrives: ['/']
      };

      mockCache.getVideoData.mockReturnValue(testData);

      const response = await request(app).get('/api/videos');

      expect(response.status).toBe(200);
      expect(response.body.videos[0].title).toBe('缓存视频');
    });
  });
});
