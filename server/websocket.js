const WebSocket = require('ws');
const { getVideoTitleByPath } = require('./middleware/video-info');
const SpriteTaskSemaphore = require('./SpriteTaskSemaphore');

let wss = null;
const clients = new Set();

// 雪碧图生成 Semaphore - 5个并发，其余排队
const spriteSemaphore = new SpriteTaskSemaphore(5);

// 批量雪碧图生成状态
let batchThreadPool = null;

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  // 监听 Semaphore 状态变化，自动广播
  spriteSemaphore.on('statusChanged', () => {
    broadcastSpriteStatus();
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket 客户端已连接');

    sendSpriteStatusToClient(ws);

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket 客户端已断开');
    });
  });
}

function broadcastSpriteStatus() {
  // 直接广播，不移除节流
  const allStatus = spriteSemaphore.getAllStatuses().map(status => ({
    ...status,
    videoTitle: status.videoTitle || (status.videoPath ? getVideoTitleByPath(status.videoPath) : undefined)
  }));
  const message = JSON.stringify({
    type: 'spriteStatus',
    data: {
      inProgress: spriteSemaphore.getActiveCount() > 0,
      queueLength: spriteSemaphore.getQueueLength(),
      allStatus: allStatus
    }
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastBatchSpriteStatus(stats) {
  const message = JSON.stringify({
    type: 'batchSpriteStatus',
    data: stats
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastScanStatus(status) {
  const message = JSON.stringify({
    type: 'scanStatus',
    data: status
  });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function sendSpriteStatusToClient(ws) {
  // 新连接时清理一次
  spriteSemaphore.cleanupOldStatuses(10);
  const allStatus = spriteSemaphore.getAllStatuses().map(status => ({
    ...status,
    videoTitle: status.videoTitle || (status.videoPath ? getVideoTitleByPath(status.videoPath) : undefined)
  }));
  const message = JSON.stringify({
    type: 'spriteStatus',
    data: {
      inProgress: spriteSemaphore.getActiveCount() > 0,
      queueLength: spriteSemaphore.getQueueLength(),
      allStatus: allStatus
    }
  });
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }

  if (batchThreadPool) {
    const batchMessage = JSON.stringify({
      type: 'batchSpriteStatus',
      data: batchThreadPool.getStats()
    });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(batchMessage);
    }
  }
}

function getSpriteSemaphore() {
  return spriteSemaphore;
}

function setBatchThreadPool(pool) {
  batchThreadPool = pool;
}

function getBatchThreadPool() {
  return batchThreadPool;
}

// 向后兼容的函数 - 标记为 deprecated
function getSpriteGenerationInProgressSet() {
  console.warn('[DEPRECATED] getSpriteGenerationInProgressSet is deprecated, use getSpriteSemaphore');
  // 返回一个模拟的 Set
  const mockSet = new Set();
  for (const status of spriteSemaphore.getAllStatuses()) {
    if (status.status === 'running') {
      mockSet.add(status.videoPath);
    }
  }
  return mockSet;
}

function getSpriteGenerationStatusMap() {
  console.warn('[DEPRECATED] getSpriteGenerationStatusMap is deprecated, use getSpriteSemaphore');
  // 返回一个模拟的 Map
  const mockMap = new Map();
  for (const status of spriteSemaphore.getAllStatuses()) {
    mockMap.set(status.videoPath, status);
  }
  return mockMap;
}

module.exports = {
  initWebSocket,
  broadcastSpriteStatus,
  broadcastBatchSpriteStatus,
  broadcastScanStatus,
  sendSpriteStatusToClient,
  getSpriteSemaphore,
  getSpriteGenerationInProgressSet, // 向后兼容
  getSpriteGenerationStatusMap,     // 向后兼容
  setBatchThreadPool,
  getBatchThreadPool
};
