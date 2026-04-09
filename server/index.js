const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const { scan } = require('../scanner/scan');
const config = require('../scanner/config');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 扫描状态
let scanInProgress = false;
let lastScanResult = null;

// 确保数据文件存在
function ensureDataFile() {
  const dataPath = path.resolve(config.outputPath);
  if (!fs.existsSync(dataPath)) {
    const dataDir = path.dirname(dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const initialData = {
      version: '1.0.0',
      generatedAt: Date.now(),
      hardDrives: [],
      directories: [],
      videos: [],
    };
    fs.writeFileSync(dataPath, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// API: 获取视频数据
app.get('/api/videos', (req, res) => {
  try {
    const dataPath = path.resolve(config.outputPath);
    ensureDataFile();
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    res.json(data);
  } catch (err) {
    console.error('读取视频数据失败:', err);
    res.status(500).json({ error: '读取数据失败' });
  }
});

// API: 触发扫描
app.post('/api/scan', (req, res) => {
  if (scanInProgress) {
    return res.json({ success: false, message: '扫描正在进行中' });
  }

  scanInProgress = true;
  res.json({ success: true, message: '扫描已开始' });

  // 异步执行扫描
  setTimeout(() => {
    try {
      lastScanResult = scan();
    } catch (err) {
      console.error('扫描出错:', err);
    } finally {
      scanInProgress = false;
    }
  }, 100);
});

// API: 获取扫描状态
app.get('/api/scan/status', (req, res) => {
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

// 根据文件扩展名获取视频 MIME 类型
function getVideoMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.m4v': 'video/x-m4v',
  };
  return mimeTypes[ext] || 'video/mp4';
}

// API: 提供视频文件流式访问
app.get('/api/video', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  try {
    const stat = fs.statSync(resolvedPath);
    const range = req.headers.range;
    const contentType = getVideoMimeType(resolvedPath);

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 50 * 1024 * 1024, stat.size - 1); // 每次最多50MB
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });

      const stream = fs.createReadStream(resolvedPath, {
        start,
        end,
        highWaterMark: 64 * 1024 // 64KB 缓冲区
      });
      stream.on('error', (err) => {
        res.end();
      });
      stream.pipe(res);
    } else {
      // 不使用完整文件传输，强制使用 range
      const end = Math.min(50 * 1024 * 1024 - 1, stat.size - 1);
      res.writeHead(206, {
        'Content-Range': `bytes 0-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end + 1,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });

      const stream = fs.createReadStream(resolvedPath, {
        start: 0,
        end,
        highWaterMark: 64 * 1024
      });
      stream.on('error', (err) => {
        res.end();
      });
      stream.pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: '读取视频失败: ' + err.message });
  }
});

// API: 提供图片文件访问
app.get('/api/image', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.gif') contentType = 'image/gif';

  res.writeHead(200, {
    'Content-Type': contentType,
  });
  const stream = fs.createReadStream(resolvedPath);
  stream.pipe(res);
});

// API: 用本地播放器打开视频
app.post('/api/open-video', (req, res) => {
  const filePath = req.body.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  console.log('打开视频:', resolvedPath);

  // 根据操作系统选择命令
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      // Windows: 使用 start 命令，需要用 shell: true
      exec(`start "" "${resolvedPath}"`, { shell: true }, (error) => {
        if (error) {
          console.warn('打开文件警告（可能已打开）:', error.message);
        }
        res.json({ success: true });
      });
    } else if (platform === 'darwin') {
      // macOS: 使用 open 命令
      exec(`open "${resolvedPath}"`, (error) => {
        if (error) {
          console.warn('打开文件警告:', error.message);
        }
        res.json({ success: true });
      });
    } else {
      // Linux: 使用 xdg-open
      exec(`xdg-open "${resolvedPath}"`, (error) => {
        if (error) {
          console.warn('打开文件警告:', error.message);
        }
        res.json({ success: true });
      });
    }
  } catch (err) {
    console.warn('执行命令失败:', err);
    res.json({ success: true }); // 即使失败也返回成功，让前端处理
  }
});

// API: 打开文件所在目录
app.post('/api/open-directory', (req, res) => {
  const dirPath = req.body.path;
  if (!dirPath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '目录不存在' });
  }

  console.log('打开目录:', resolvedPath);

  const platform = process.platform;

  try {
    if (platform === 'win32') {
      // Windows: 使用 explorer，需要用 shell: true
      exec(`explorer "${resolvedPath}"`, { shell: true }, (error) => {
        if (error) {
          console.warn('打开目录警告（可能已打开）:', error.message);
        }
        res.json({ success: true });
      });
    } else if (platform === 'darwin') {
      // macOS: 使用 open
      exec(`open "${resolvedPath}"`, (error) => {
        if (error) {
          console.warn('打开目录警告:', error.message);
        }
        res.json({ success: true });
      });
    } else {
      // Linux: 使用 xdg-open
      exec(`xdg-open "${resolvedPath}"`, (error) => {
        if (error) {
          console.warn('打开目录警告:', error.message);
        }
        res.json({ success: true });
      });
    }
  } catch (err) {
    console.warn('执行命令失败:', err);
    res.json({ success: true }); // 即使失败也返回成功
  }
});

// 启动服务器
ensureDataFile();
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 端点:`);
  console.log(`  GET  /api/videos       - 获取视频列表`);
  console.log(`  POST /api/scan         - 触发重新扫描`);
  console.log(`  GET  /api/scan/status  - 获取扫描状态`);
  console.log(`  GET  /api/video        - 视频文件流式服务`);
  console.log(`  GET  /api/image        - 图片文件服务`);
  console.log(`  POST /api/open-video   - 用本地播放器打开视频`);
  console.log(`  POST /api/open-directory - 打开文件所在目录`);
});
