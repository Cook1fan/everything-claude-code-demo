module.exports = {
  isPathAllowed: jest.fn().mockReturnValue(true),
  normalizePath: jest.fn(p => p.replace(/\\/g, '/')),
  getAllowedDirectories: jest.fn().mockReturnValue([])
};
