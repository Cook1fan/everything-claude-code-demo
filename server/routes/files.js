const express = require('express');
const path = require('path');
const fs = require('fs');
const { isPathAllowed } = require('../middleware/path');
const { getVideoMimeType, safeOpen } = require('../utils');

const router = express.Router();

const VIDEO_CHUNK_SIZE = 50 * 1024 * 1024;
const STREAM_HIGH_WATER_MARK = 64 * 1024;

router.get('/video', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

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
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + VIDEO_CHUNK_SIZE, stat.size - 1);
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
        highWaterMark: STREAM_HIGH_WATER_MARK
      });
      stream.on('error', (err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: '视频流读取失败' });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } else {
      const end = Math.min(VIDEO_CHUNK_SIZE - 1, stat.size - 1);
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
        highWaterMark: STREAM_HIGH_WATER_MARK
      });
      stream.on('error', (err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: '视频流读取失败' });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: '读取视频失败: ' + err.message });
  }
});

router.get('/image', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.vtt') contentType = 'text/vtt; charset=utf-8';
  else if (ext === '.json') contentType = 'application/json; charset=utf-8';

  const isCacheable = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  const headers = {
    'Content-Type': contentType,
  };
  if (isCacheable) {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  res.writeHead(200, headers);
  const stream = fs.createReadStream(resolvedPath);
  stream.pipe(res);
});

router.post('/open-video', (req, res) => {
  const filePath = req.body.path;
  if (!filePath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  console.log('打开视频:', resolvedPath);

  safeOpen(resolvedPath, false)
    .then(() => res.json({ success: true }))
    .catch((err) => {
      console.warn('打开文件失败:', err.message);
      res.json({ success: true });
    });
});

router.post('/open-directory', (req, res) => {
  const dirPath = req.body.path;
  if (!dirPath) {
    return res.status(400).json({ error: '缺少 path 参数' });
  }

  const resolvedPath = path.resolve(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '目录不存在' });
  }

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  console.log('打开目录:', resolvedPath);

  safeOpen(resolvedPath, true)
    .then(() => res.json({ success: true }))
    .catch((err) => {
      console.warn('打开目录失败:', err.message);
      res.json({ success: true });
    });
});

module.exports = router;
