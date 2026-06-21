const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { isPathAllowed } = require('../middleware/path');
const { checkFFmpeg, getVideoDuration } = require('../../scanner/spriteGenerator');

const router = express.Router();

const FPS = 12;
const WIDTH = 480;
const MIN_DURATION = 3;
const MAX_DURATION = 8;
const DEFAULT_DURATION = 3;
const TIMEOUT_MS = 60000;

function resolveVideoPath(input) {
  if (typeof input !== 'string' || input.length === 0) return null;
  try {
    return path.resolve(input);
  } catch {
    return null;
  }
}

function clampDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DURATION;
  if (value < MIN_DURATION || value > MAX_DURATION) return DEFAULT_DURATION;
  return value;
}

function clampStart(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function makeTempDir() {
  const taskId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join(os.tmpdir(), `gif-maker-${taskId}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // 静默失败,避免掩盖原始错误
  }
}

function buildPaletteArgs(videoPath, start, duration, palettePath) {
  return [
    '-y',
    '-ss', String(start),
    '-t', String(duration),
    '-i', videoPath,
    '-vf', `fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen`,
    palettePath,
  ];
}

function buildGifArgs(videoPath, start, duration, palettePath, gifPath) {
  return [
    '-y',
    '-ss', String(start),
    '-t', String(duration),
    '-i', videoPath,
    '-i', palettePath,
    '-filter_complex', `[0:v]fps=${FPS},scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    gifPath,
  ];
}

router.post('/make', async (req, res) => {
  const { videoPath: rawPath, startTime: rawStart, duration: rawDuration } = req.body || {};

  const resolvedPath = resolveVideoPath(rawPath);
  if (!resolvedPath) {
    return res.status(400).json({ error: '缺少或无效的 videoPath 参数' });
  }

  if (!isPathAllowed(resolvedPath)) {
    return res.status(403).json({ error: '禁止访问该路径' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: '视频文件不存在' });
  }

  const start = clampStart(rawStart);
  const requestedDuration = clampDuration(rawDuration);

  let ffmpegStatus;
  try {
    ffmpegStatus = await checkFFmpeg();
  } catch (err) {
    return res.status(500).json({ error: '检查 ffmpeg 失败' });
  }
  if (!ffmpegStatus.available || !ffmpegStatus.path) {
    return res.status(500).json({ error: ffmpegStatus.message || 'ffmpeg 不可用' });
  }
  const ffmpegPath = ffmpegStatus.path;

  let totalDuration;
  try {
    totalDuration = await getVideoDuration(ffmpegPath, resolvedPath);
  } catch (err) {
    return res.status(500).json({ error: '无法获取视频时长' });
  }

  const endTime = Math.min(start + requestedDuration, totalDuration);
  const actualDuration = endTime - start;
  if (actualDuration <= 0) {
    return res.status(400).json({ error: '起点已超出视频末尾' });
  }

  const tempDir = makeTempDir();
  const palettePath = path.join(tempDir, 'palette.png');
  const gifPath = path.join(tempDir, 'out.gif');

  // 响应关闭时清理临时目录
  res.on('close', () => cleanupTempDir(tempDir));

  // Pass 1: 生成调色板
  execFile(ffmpegPath, buildPaletteArgs(resolvedPath, start, actualDuration, palettePath), { timeout: TIMEOUT_MS }, (paletteErr) => {
    if (paletteErr) {
      cleanupTempDir(tempDir);
      if (!res.headersSent) {
        return res.status(500).json({ error: `palettegen 失败: ${paletteErr.message}` });
      }
      return res.end();
    }

    // Pass 2: 生成 GIF
    execFile(ffmpegPath, buildGifArgs(resolvedPath, start, actualDuration, palettePath, gifPath), { timeout: TIMEOUT_MS }, (gifErr) => {
      if (gifErr) {
        cleanupTempDir(tempDir);
        if (!res.headersSent) {
          return res.status(500).json({ error: `paletteuse 失败: ${gifErr.message}` });
        }
        return res.end();
      }

      if (!fs.existsSync(gifPath)) {
        cleanupTempDir(tempDir);
        if (!res.headersSent) {
          return res.status(500).json({ error: 'GIF 生成失败' });
        }
        return res.end();
      }

      const stat = fs.statSync(gifPath);
      const filename = `clip_${Math.floor(start)}s.gif`;

      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('X-Actual-Duration', String(actualDuration));
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      try {
        const buffer = fs.readFileSync(gifPath);
        res.end(buffer);
      } catch (readErr) {
        if (!res.headersSent) res.status(500).end();
      }
    });
  });
});

module.exports = router;
