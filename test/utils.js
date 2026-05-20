const fs = require('fs');
const path = require('path');

/**
 * 创建测试视频数据
 */
function createTestVideoData(options = {}) {
  return {
    videos: options.videos || [
      {
        id: 'test-1',
        title: '测试视频 1',
        videoPath: '/test/video1.mp4',
        directory: '/test',
        hardDrive: '/',
        duration: 3600,
        size: 1000000000
      },
      {
        id: 'test-2',
        title: '测试视频 2',
        videoPath: '/test/video2.mp4',
        directory: '/test',
        hardDrive: '/',
        duration: 7200,
        size: 2000000000
      }
    ],
    directories: ['/test'],
    hardDrives: ['/'],
    generatedAt: Date.now()
  };
}

/**
 * 创建临时测试文件
 */
function createTempFile(dir, filename, content = '') {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * 创建临时 JSON 文件
 */
function createTempJsonFile(dir, filename, data) {
  return createTempFile(dir, filename, JSON.stringify(data, null, 2));
}

/**
 * Mock Express 响应对象
 */
function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.writeHead = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Mock Express 请求对象
 */
function mockRequest(options = {}) {
  return {
    query: options.query || {},
    body: options.body || {},
    params: options.params || {},
    headers: options.headers || {},
    ip: options.ip || '127.0.0.1',
    on: jest.fn(),
    ...options
  };
}

/**
 * Mock WebSocket
 */
function mockWebSocket() {
  return {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    ping: jest.fn()
  };
}

module.exports = {
  createTestVideoData,
  createTempFile,
  createTempJsonFile,
  mockResponse,
  mockRequest,
  mockWebSocket
};
