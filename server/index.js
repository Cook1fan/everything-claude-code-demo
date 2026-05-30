const http = require('http');
const path = require('path');

const config = require('../scanner/config');
const { ensureDataFile } = require('./utils');
const { initWebSocket, broadcastScanStatus } = require('./websocket');
const { createApp } = require('./app');

const PORT = 3000;
const app = createApp();
const server = http.createServer(app);

// 全局未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('[Server] 未捕获的异常:', err);
  // 不退出进程，继续运行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] 未处理的 Promise 拒绝:', reason);
  // 不退出进程，继续运行
});

// 初始化 WebSocket
initWebSocket(server);

// 启动服务器
ensureDataFile();
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 端点:`);
  console.log(`  GET  /api/videos       - 获取视频列表`);
  console.log(`  POST /api/scan         - 触发重新扫描`);
  console.log(`  GET  /api/scan/status  - 获取扫描状态`);
  console.log(`  GET  /api/video        - 视频文件流式服务`);
  console.log(`  GET  /api/image        - 图片文件服务`);
  console.log(`  POST /api/open-video   - 用本地播放器打开视频`);
  console.log(`  POST /api/open-directory - 打开文件所在目录`);
  console.log(`  GET  /api/ffmpeg/status - 检查 FFmpeg 状态`);
  console.log(`  POST /api/sprite/generate - 生成雪碧图`);
  console.log(`  GET  /api/sprite/status - 获取雪碧图生成状态`);
  console.log(`  GET  /api/sprite/info - 获取雪碧图信息`);
  console.log(`  POST /api/sprite/batch-generate - 批量生成雪碧图`);
  console.log(`  GET  /api/sprite/batch-status - 获取批量生成状态`);
  console.log(`  POST /api/sprite/batch-abort - 中止批量生成`);
  console.log(`  POST /api/frame-extract/start - 开始帧提取任务`);
  console.log(`  GET  /api/frame-extract/status - 获取所有任务状态`);
  console.log(`  GET  /api/frame-extract/status/:taskId - 获取单个任务状态`);
  console.log(`  POST /api/frame-extract/abort - 中止任务`);
  console.log(`  GET  /api/frame-extract/download/:taskId - 下载提取的帧 (ZIP)`);
  console.log(`  POST /api/frame-extract/clear-history - 清除历史任务`);
  console.log(`WebSocket: ws://localhost:${PORT} - 实时状态推送`);
});

module.exports = { server };
