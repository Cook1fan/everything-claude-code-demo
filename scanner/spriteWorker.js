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
const { cleanup } = require('./spriteGenerator');

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
  })
  .finally(() => {
    // 显式释放 timer 并退出进程，避免 Worker 残留
    cleanup();
    process.exit(0);
  });
