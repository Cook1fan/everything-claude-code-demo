const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const config = require('../scanner/config');
const { isPathAllowed, normalizePath } = require('./middleware/path');

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

function safeOpen(targetPath, isDirectory = false) {
  const resolvedPath = path.resolve(targetPath);
  if (!isPathAllowed(resolvedPath)) {
    return Promise.reject(new Error('路径不在允许范围内'));
  }

  return new Promise((resolve, reject) => {
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        if (isDirectory) {
          spawn('explorer', [resolvedPath], { detached: true, stdio: 'ignore' });
        } else {
          spawn('cmd', ['/c', 'start', '', resolvedPath], { detached: true, stdio: 'ignore' });
        }
      } else if (platform === 'darwin') {
        spawn('open', [resolvedPath], { detached: true, stdio: 'ignore' });
      } else {
        spawn('xdg-open', [resolvedPath], { detached: true, stdio: 'ignore' });
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { ensureDataFile, getVideoMimeType, safeOpen };
