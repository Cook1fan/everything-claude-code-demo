const fs = require('fs');
const path = require('path');

// 先 mock 依赖
jest.mock('fs');
jest.mock('../scanner/config', () => ({
  outputPath: '/test/data/videos.json',
  hardDrives: []
}));
jest.mock('../server/middleware/path', () => ({
  isPathAllowed: jest.fn().mockReturnValue(true),
  normalizePath: jest.fn(p => p)
}));

// 单独 mock child_process
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: mockSpawn
}));

describe('Utils', () => {
  let utilsModule;

  beforeEach(() => {
    jest.resetAllMocks();
    // 清除模块缓存后重新引入
    delete require.cache[require.resolve('../server/utils')];
    utilsModule = require('../server/utils');
  });

  describe('ensureDataFile', () => {
    test('文件存在时不应该做任何事', () => {
      fs.existsSync.mockReturnValue(true);
      utilsModule.ensureDataFile();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('getVideoMimeType', () => {
    test('应该返回正确的MIME类型', () => {
      expect(utilsModule.getVideoMimeType('test.mp4')).toBe('video/mp4');
      expect(utilsModule.getVideoMimeType('test.webm')).toBe('video/webm');
      expect(utilsModule.getVideoMimeType('test.ogg')).toBe('video/ogg');
      expect(utilsModule.getVideoMimeType('test.mkv')).toBe('video/x-matroska');
    });

    test('未知扩展名应该返回默认的video/mp4', () => {
      expect(utilsModule.getVideoMimeType('test.xyz')).toBe('video/mp4');
    });
  });

  describe('safeOpen', () => {
    test('应该在Windows上打开文件', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      await utilsModule.safeOpen('C:/test/file.mp4', false);
      expect(mockSpawn).toHaveBeenCalled();
    });

    test('路径不允许时应该拒绝', async () => {
      const pathMiddleware = require('../server/middleware/path');
      pathMiddleware.isPathAllowed.mockReturnValue(false);
      await expect(utilsModule.safeOpen('/forbidden/file.mp4')).rejects.toThrow();
    });
  });
});
