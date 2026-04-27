const express = require('express');
const path = require('path');
const fs = require('fs');
const { getVideoData } = require('../middleware/cache');
const { ensureDataFile } = require('../utils');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    ensureDataFile();
    const data = getVideoData() || JSON.parse(fs.readFileSync(path.resolve(require('../../scanner/config').outputPath), 'utf-8'));

    if (data.videos && Array.isArray(data.videos)) {
      data.videos = data.videos.map(video => {
        if (video.spritePath && !video.spriteVttPath) {
          const vttPath = video.spritePath.replace(/\.(jpg|jpeg|png)$/, '.vtt');
          return {
            ...video,
            spriteVttPath: vttPath
          };
        }
        return video;
      });
    }

    const page = parseInt(req.query.page, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 0;

    if (page > 0 && limit > 0) {
      const totalVideos = data.videos.length;
      const startIdx = (page - 1) * limit;
      const pagedVideos = data.videos.slice(startIdx, startIdx + limit);

      res.json({
        ...data,
        videos: pagedVideos,
        pagination: {
          page,
          limit,
          total: totalVideos,
          totalPages: Math.ceil(totalVideos / limit),
        },
      });
    } else {
      res.json(data);
    }
  } catch (err) {
    console.error('读取视频数据失败:', err);
    res.status(500).json({ error: '读取数据失败' });
  }
});

module.exports = router;
