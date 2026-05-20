module.exports = {
  checkFFmpeg: jest.fn().mockResolvedValue({
    available: true,
    path: '/usr/bin/ffmpeg',
    version: '4.4'
  }),
  generateSprite: jest.fn().mockResolvedValue({
    spritePath: '/test/video1.jpg',
    vttPath: '/test/video1.vtt'
  }),
  abortSpriteGeneration: jest.fn()
};
