const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const { generateSprite } = require('./spriteGenerator');

const { videoPath, options = {} } = workerData;

console.log('[Worker] 开始处理:', path.basename(videoPath));

// 进度回调函数
function onProgress(status) {
  parentPort.postMessage({
    type: 'progress',
    videoPath,
    ...status
  });
}

// 执行雪碧图生成
generateSprite(videoPath, options, onProgress)
  .then(result => {
    console.log('[Worker] 处理完成:', path.basename(videoPath));
    parentPort.postMessage({
      type: 'complete',
      videoPath,
      success: true,
      ...result
    });
  })
  .catch(error => {
    console.error('[Worker] 处理失败:', path.basename(videoPath), error.message);
    parentPort.postMessage({
      type: 'error',
      videoPath,
      success: false,
      error: error.message
    });
  });
