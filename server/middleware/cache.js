const path = require('path');
const fs = require('fs');
const config = require('../../scanner/config');

let videoDataCache = null;
let videoDataCacheTime = 0;
const CACHE_TTL = 60000; // 60秒缓存

function getVideoData() {
  const now = Date.now();
  if (videoDataCache && (now - videoDataCacheTime) < CACHE_TTL) {
    return videoDataCache;
  }
  try {
    const dataPath = path.resolve(config.outputPath);
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      videoDataCache = data;
      videoDataCacheTime = now;
      return data;
    }
  } catch (err) {
    console.error('读取视频数据失败:', err);
  }
  return null;
}

function clearVideoDataCache() {
  videoDataCache = null;
  videoDataCacheTime = 0;
}

module.exports = { getVideoData, clearVideoDataCache };
