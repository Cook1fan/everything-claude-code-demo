const fs = require('fs');

// 先 mock 依赖
jest.mock('fs');
jest.mock('../../scanner/config', () => ({
  outputPath: '/test/data/videos.json'
}));

describe('Cache Middleware', () => {
  let cacheModule;

  beforeEach(() => {
    jest.resetAllMocks();
    // 清除模块缓存后重新引入
    delete require.cache[require.resolve('../../server/middleware/cache')];
    cacheModule = require('../../server/middleware/cache');
  });

  describe('getVideoData', () => {
    test('文件不存在时应该返回 null', () => {
      fs.existsSync.mockReturnValue(false);
      const result = cacheModule.getVideoData();
      expect(result).toBeNull();
    });

    test('读取文件出错时应该返回 null', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      const result = cacheModule.getVideoData();
      expect(result).toBeNull();
    });
  });

  describe('clearVideoDataCache', () => {
    test('应该清除缓存', () => {
      // 这个测试主要是验证函数能被调用
      cacheModule.clearVideoDataCache();
      // 确保没有抛出错误
      expect(true).toBe(true);
    });
  });
});
