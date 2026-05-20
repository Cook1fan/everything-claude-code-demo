// 先 mock 依赖
jest.mock('../../server/middleware/cache', () => ({
  getVideoData: jest.fn(),
  clearVideoDataCache: jest.fn()
}));

describe('Video Info Middleware', () => {
  let videoInfoModule;
  let mockCache;
  let mockVideoData;

  beforeEach(() => {
    jest.resetAllMocks();

    mockVideoData = {
      videos: [
        { id: '1', title: 'Test Video 1', videoPath: 'C:/test/video1.mp4' },
        { id: '2', title: 'Test Video 2', videoPath: 'C:/test/video2.mp4' }
      ]
    };

    mockCache = require('../../server/middleware/cache');
    mockCache.getVideoData.mockReturnValue(mockVideoData);

    // 清除模块缓存后重新引入
    delete require.cache[require.resolve('../../server/middleware/video-info')];
    videoInfoModule = require('../../server/middleware/video-info');
  });

  describe('getVideoTitleByPath', () => {
    test('应该返回视频标题', () => {
      const title = videoInfoModule.getVideoTitleByPath('C:/test/video1.mp4');
      expect(title).toBe('Test Video 1');
    });

    test('找不到视频时应该返回 null', () => {
      const title = videoInfoModule.getVideoTitleByPath('C:/test/nonexistent.mp4');
      expect(title).toBeNull();
    });

    test('应该使用缓存返回相同视频的标题', () => {
      videoInfoModule.getVideoTitleByPath('C:/test/video1.mp4');
      videoInfoModule.getVideoTitleByPath('C:/test/video1.mp4');
      expect(mockCache.getVideoData).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVideoIdByPath', () => {
    test('应该返回视频ID', () => {
      const id = videoInfoModule.getVideoIdByPath('C:/test/video2.mp4');
      expect(id).toBe('2');
    });

    test('找不到视频时应该返回 null', () => {
      const id = videoInfoModule.getVideoIdByPath('C:/test/nonexistent.mp4');
      expect(id).toBeNull();
    });
  });

  describe('clearVideoInfoCache', () => {
    test('应该清除缓存', () => {
      videoInfoModule.getVideoTitleByPath('C:/test/video1.mp4');
      videoInfoModule.clearVideoInfoCache();
      videoInfoModule.getVideoTitleByPath('C:/test/video1.mp4');
      expect(mockCache.getVideoData).toHaveBeenCalledTimes(2);
    });
  });
});
