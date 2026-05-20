const fs = require('fs');
const path = require('path');

// 测试数据目录
const TEST_DATA_DIR = path.join(__dirname, 'data');
const TEST_VIDEO_DIR = path.join(__dirname, 'videos');

// 在所有测试前运行
beforeAll(async () => {
  // 确保测试数据目录存在
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_VIDEO_DIR)) {
    fs.mkdirSync(TEST_VIDEO_DIR, { recursive: true });
  }
});

// 在每个测试前运行
beforeEach(() => {
  // 清理所有模块缓存
  jest.resetModules();
});

// 在所有测试后运行
afterAll(async () => {
  // 清理测试文件
  cleanupTestFiles();
});

function cleanupTestFiles() {
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      const files = fs.readdirSync(TEST_DATA_DIR);
      for (const file of files) {
        const filePath = path.join(TEST_DATA_DIR, file);
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.warn('清理测试文件失败:', err);
  }
}

module.exports = {
  TEST_DATA_DIR,
  TEST_VIDEO_DIR,
  cleanupTestFiles
};
