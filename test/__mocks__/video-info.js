module.exports = {
  getVideoIdByPath: jest.fn().mockReturnValue('test-video-id'),
  getVideoTitleByPath: jest.fn().mockReturnValue('测试视频'),
  clearVideoInfoCache: jest.fn()
};
