module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  collectCoverageFrom: [
    'server/app.js',
    'server/routes/videos.js',
    'server/middleware/path.js',
    'server/middleware/video-info.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
