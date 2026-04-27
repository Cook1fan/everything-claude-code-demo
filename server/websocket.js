const WebSocket = require('ws');
const { getVideoTitleByPath } = require('./middleware/video-info');

let wss = null;
const clients = new Set();

let broadcastTimeout = null;
let pendingBroadcast = false;

// 雪碧图生成状态 - 支持多个同时生成
let spriteGenerationInProgressSet = new Set();
let spriteGenerationStatusMap = new Map();

// 批量雪碧图生成状态
let batchThreadPool = null;

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

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
  if (broadcastTimeout) {
    pendingBroadcast = true;
    return;
  }

  doBroadcast();

  broadcastTimeout = setTimeout(() => {
    broadcastTimeout = null;
    if (pendingBroadcast) {
      pendingBroadcast = false;
      doBroadcast();
    }
  }, 100);
}

function doBroadcast() {
  const allStatus = Array.from(spriteGenerationStatusMap.values());
  const message = JSON.stringify({
    type: 'spriteStatus',
    data: {
      inProgress: spriteGenerationInProgressSet.size > 0,
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
  const allStatus = Array.from(spriteGenerationStatusMap.values()).map(status => ({
    ...status,
    videoTitle: status.videoTitle || (status.videoPath ? getVideoTitleByPath(status.videoPath) : undefined)
  }));
  const message = JSON.stringify({
    type: 'spriteStatus',
    data: {
      inProgress: spriteGenerationInProgressSet.size > 0,
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

function getSpriteGenerationInProgressSet() {
  return spriteGenerationInProgressSet;
}

function getSpriteGenerationStatusMap() {
  return spriteGenerationStatusMap;
}

function setBatchThreadPool(pool) {
  batchThreadPool = pool;
}

function setBatchThreadPool(pool) {
  batchThreadPool = pool;
}

function getBatchThreadPool() {
  return batchThreadPool;
}

module.exports = {
  initWebSocket,
  broadcastSpriteStatus,
  broadcastBatchSpriteStatus,
  broadcastScanStatus,
  sendSpriteStatusToClient,
  getSpriteGenerationInProgressSet,
  getSpriteGenerationStatusMap,
  setBatchThreadPool,
  getBatchThreadPool
};
