const path = require('path');
const fs = require('fs');
const config = require('../../scanner/config');

let videoDataCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60秒缓存
let autoExpireTimeout = null;

function getCachedVideoData() {
  if (!videoDataCache) return null;
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    clearVideoCache();
    return null;
  }
  return videoDataCache;
}

function setCachedVideoData(data) {
  clearVideoCache();
  videoDataCache = data;
  cacheTimestamp = Date.now();

  // 设置自动过期
  if (autoExpireTimeout) {
    clearTimeout(autoExpireTimeout);
  }
  autoExpireTimeout = setTimeout(() => {
    if (videoDataCache === data) {
      clearVideoCache();
    }
  }, CACHE_TTL);
}

function clearVideoCache() {
  if (videoDataCache) {
    // 帮助 GC
    if (Array.isArray(videoDataCache.videos)) {
      videoDataCache.videos.length = 0;
    }
    videoDataCache = null;
  }
  cacheTimestamp = 0;
  if (autoExpireTimeout) {
    clearTimeout(autoExpireTimeout);
    autoExpireTimeout = null;
  }
}

function getVideoData() {
  const cached = getCachedVideoData();
  if (cached) {
    return cached;
  }
  try {
    const dataPath = path.resolve(config.outputPath);
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      setCachedVideoData(data);
      return data;
    }
  } catch (err) {
    console.error('读取视频数据失败:', err);
  }
  return null;
}

function clearVideoDataCache() {
  clearVideoCache();
}

module.exports = { getVideoData, clearVideoDataCache, getCachedVideoData, setCachedVideoData, clearVideoCache };
