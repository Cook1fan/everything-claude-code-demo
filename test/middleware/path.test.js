const path = require('path');

// 先 mock 依赖
jest.mock('../../scanner/config', () => ({
  hardDrives: ['C:/allowed'],
  outputPath: 'C:/data/videos.json'
}));

describe('Path Middleware', () => {
  let pathModule;

  beforeEach(() => {
    jest.resetAllMocks();
    // 清除模块缓存后重新引入
    delete require.cache[require.resolve('../../server/middleware/path')];
    pathModule = require('../../server/middleware/path');
  });

  describe('normalizePath', () => {
    test('应该将反斜杠转换为正斜杠', () => {
      expect(pathModule.normalizePath('C:\\test\\path')).toBe('C:/test/path');
    });

    test('应该保持正斜杠不变', () => {
      expect(pathModule.normalizePath('C:/test/path')).toBe('C:/test/path');
    });
  });

  describe('isPathAllowed', () => {
    test('应该允许配置的目录内的路径', () => {
      expect(pathModule.isPathAllowed('C:/allowed/video.mp4')).toBe(true);
    });

    test('应该允许配置的目录本身', () => {
      expect(pathModule.isPathAllowed('C:/allowed')).toBe(true);
    });

    test('应该禁止不在允许目录内的路径', () => {
      expect(pathModule.isPathAllowed('C:/forbidden/video.mp4')).toBe(false);
    });

    test('应该允许输出目录', () => {
      expect(pathModule.isPathAllowed('C:/data/videos.json')).toBe(true);
    });
  });

  describe('getAllowedDirectories', () => {
    test('应该返回所有允许的目录', () => {
      const allowed = pathModule.getAllowedDirectories();
      expect(allowed).toContain('C:/allowed');
    });
  });
});
