module.exports = {
  ensureDataFile: jest.fn(),
  getVideoMimeType: jest.fn().mockReturnValue('video/mp4'),
  safeOpen: jest.fn().mockResolvedValue(true)
};
