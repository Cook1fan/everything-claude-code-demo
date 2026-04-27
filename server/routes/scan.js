const express = require('express');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const config = require('../../scanner/config');
const { clearVideoDataCache } = require('../middleware/cache');
const { clearVideoInfoCache } = require('../middleware/video-info');
const { broadcastScanStatus } = require('../websocket');

const router = express.Router();
let scanInProgress = false;

router.post('/', (req, res) => {
  if (scanInProgress) {
    return res.json({ success: false, message: '扫描正在进行中' });
  }

  scanInProgress = true;
  res.json({ success: true, message: '扫描已开始' });

  const scanWorker = new Worker(path.join(__dirname, '..', '..', 'scanner', 'scanWorker.js'));

  scanWorker.on('message', (message) => {
    if (message.type === 'success') {
      clearVideoDataCache();
      clearVideoInfoCache();
      broadcastScanStatus({ scanning: false, success: true, videoCount: message.result?.videos?.length || 0 });
    } else {
      console.error('扫描出错:', message.error);
      broadcastScanStatus({ scanning: false, success: false, error: message.error });
    }
    scanInProgress = false;
    scanWorker.terminate();
  });

  scanWorker.on('error', (err) => {
    console.error('扫描 Worker 错误:', err);
    broadcastScanStatus({ scanning: false, success: false, error: err.message });
    scanInProgress = false;
    scanWorker.terminate();
  });

  scanWorker.on('exit', (code) => {
    if (code !== 0) {
      console.error('扫描 Worker 异常退出，退出码:', code);
      broadcastScanStatus({ scanning: false, success: false, error: '扫描进程异常退出' });
      scanInProgress = false;
    }
  });
});

router.get('/status', (req, res) => {
  let videoCount = 0;
  let lastScan = null;

  try {
    const dataPath = path.resolve(config.outputPath);
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      videoCount = data.videos?.length || 0;
      lastScan = data.generatedAt || null;
    }
  } catch (err) {
    console.error('读取状态失败:', err);
  }

  res.json({
    scanning: scanInProgress,
    lastScan: lastScan,
    videoCount: videoCount,
  });
});

module.exports = router;
