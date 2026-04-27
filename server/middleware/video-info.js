const { normalizePath } = require('./path');
const { getVideoData } = require('./cache');

let videoInfoCache = new Map();

function getVideoTitleByPath(videoPath) {
  const normalizedPath = normalizePath(videoPath);
  const cached = videoInfoCache.get(normalizedPath);
  if (cached && cached.title) {
    return cached.title;
  }

  const data = getVideoData();
  if (data && data.videos) {
    const video = data.videos.find(v => normalizePath(v.videoPath) === normalizedPath);
    if (video) {
      videoInfoCache.set(normalizedPath, { title: video.title, id: video.id });
      return video.title;
    }
  }
  return null;
}

function getVideoIdByPath(videoPath) {
  const normalizedPath = normalizePath(videoPath);
  const cached = videoInfoCache.get(normalizedPath);
  if (cached && cached.id) {
    return cached.id;
  }

  const data = getVideoData();
  if (data && data.videos) {
    const video = data.videos.find(v => normalizePath(v.videoPath) === normalizedPath);
    if (video) {
      videoInfoCache.set(normalizedPath, { title: video.title, id: video.id });
      return video.id;
    }
  }
  return null;
}

function clearVideoInfoCache() {
  videoInfoCache.clear();
}

module.exports = { getVideoTitleByPath, getVideoIdByPath, clearVideoInfoCache };
