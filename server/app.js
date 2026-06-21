const express = require('express');
const cors = require('cors');

const videosRouter = require('./routes/videos');
const scanRouter = require('./routes/scan');
const filesRouter = require('./routes/files');
const spriteRouter = require('./routes/sprite');
const frameExtractRouter = require('./routes/frameExtract');
const deletionRecordsRouter = require('./routes/deletionRecords');
const gifRouter = require('./routes/gif');

const createApp = () => {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json());

  // API 路由
  app.use('/api/videos', videosRouter);
  app.use('/api/scan', scanRouter);
  app.use('/api', filesRouter);
  app.use('/api/sprite', spriteRouter);
  app.use('/api/frame-extract', frameExtractRouter);
  app.use('/api/deletion-records', deletionRecordsRouter);
  app.use('/api/gif', gifRouter);

  return app;
};

module.exports = { createApp };
