const WebSocket = require('ws');
const { getVideoTitleByPath } = require('./middleware/video-info');
const SpriteTaskSemaphore = require('./SpriteTaskSemaphore');
const { frameTaskSemaphore } = require('../scanner/FrameTaskSemaphore');

let wss = null;
const clients = new Set();
const clientTimestamps = new Map(); // ws -> lastSeen
let deadConnectionCheckInterval = null;

// 心跳配置
const HEARTBEAT_INTERVAL = 30 * 1000; // 30秒
const HEARTBEAT_TIMEOUT = 10 * 1000; // 10秒

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
    clientTimestamps.set(ws, Date.now());
    console.log('WebSocket 客户端已连接');

    // 心跳检测 - 定期发送 ping
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const sentAt = Date.now();
        ws.ping();

        // 设置超时，如果在超时时间内没收到 pong 就关闭连接
        const timeout = setTimeout(() => {
          const lastSeen = clientTimestamps.get(ws) || 0;
          if (lastSeen < sentAt) {
            console.log('[WebSocket] 客户端心跳超时，关闭连接');
            ws.close();
          }
        }, HEARTBEAT_TIMEOUT);

        // 保存 timeout 引用，便于清理
        ws._heartbeatTimeout = timeout;
      }
    }, HEARTBEAT_INTERVAL);

    ws._heartbeat = heartbeat;

    // 收到 pong 更新时间戳
    ws.on('pong', () => {
      clientTimestamps.set(ws, Date.now());
      if (ws._heartbeatTimeout) {
        clearTimeout(ws._heartbeatTimeout);
        ws._heartbeatTimeout = null;
      }
    });

    sendSpriteStatusToClient(ws);

    ws.on('close', () => {
      clients.delete(ws);
      clientTimestamps.delete(ws);
      if (ws._heartbeat) {
        clearInterval(ws._heartbeat);
      }
      if (ws._heartbeatTimeout) {
        clearTimeout(ws._heartbeatTimeout);
      }
      console.log('WebSocket 客户端已断开');
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] 错误:', err);
      clients.delete(ws);
      clientTimestamps.delete(ws);
      if (ws._heartbeat) {
        clearInterval(ws._heartbeat);
      }
      if (ws._heartbeatTimeout) {
        clearTimeout(ws._heartbeatTimeout);
      }
    });
  });

  // 定期清理死连接（每 HEARTBEAT_INTERVAL 检查一次）
  if (process.env.NODE_ENV !== 'test') {
    deadConnectionCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const ws of clients) {
        const lastSeen = clientTimestamps.get(ws) || 0;
        if (now - lastSeen > 2 * HEARTBEAT_INTERVAL) {
          console.log('[WebSocket] 清理死连接');
          ws.close();
          clients.delete(ws);
          clientTimestamps.delete(ws);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }
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

function broadcastFrameExtractStatus(taskId, task, eventType) {
  const message = JSON.stringify({
    type: 'frameExtractStatus',
    data: {
      taskId,
      task,
      eventType
    }
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

  // Also send frame extract status
  const frameTasks = frameTaskSemaphore.getAllTasks();
  const frameMessage = JSON.stringify({
    type: 'frameExtractStatus',
    data: {
      inProgress: frameTaskSemaphore.getActiveCount() > 0,
      tasks: frameTasks
    }
  });
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(frameMessage);
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

/**
 * 清理资源（用于测试）
 */
function cleanup() {
  if (deadConnectionCheckInterval) {
    clearInterval(deadConnectionCheckInterval);
    deadConnectionCheckInterval = null;
  }
  // 关闭所有连接
  for (const ws of clients) {
    ws.close();
  }
  clients.clear();
  clientTimestamps.clear();
}

module.exports = {
  initWebSocket,
  broadcastSpriteStatus,
  broadcastBatchSpriteStatus,
  broadcastScanStatus,
  broadcastFrameExtractStatus,
  sendSpriteStatusToClient,
  getSpriteSemaphore,
  getSpriteGenerationInProgressSet, // 向后兼容
  getSpriteGenerationStatusMap,     // 向后兼容
  setBatchThreadPool,
  getBatchThreadPool,
  cleanup
};
