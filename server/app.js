const express = require('express');
const cors = require('cors');

const videosRouter = require('./routes/videos');
const scanRouter = require('./routes/scan');
const filesRouter = require('./routes/files');
const spriteRouter = require('./routes/sprite');

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

  return app;
};

module.exports = { createApp };
