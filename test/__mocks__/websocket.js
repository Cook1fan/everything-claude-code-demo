module.exports = {
  initWebSocket: jest.fn(),
  broadcastScanStatus: jest.fn(),
  getSpriteSemaphore: jest.fn().mockReturnValue({
    isVideoInQueueOrRunning: jest.fn().mockReturnValue(false),
    cleanupOldStatuses: jest.fn(),
    submit: jest.fn().mockReturnValue('test-task-id'),
    getStatusByVideoPath: jest.fn().mockReturnValue({}),
    getAllStatuses: jest.fn().mockReturnValue([]),
    getActiveCount: jest.fn().mockReturnValue(0),
    getQueueLength: jest.fn().mockReturnValue(0),
    abort: jest.fn().mockReturnValue(true),
    clearCompletedTasks: jest.fn()
  }),
  getBatchThreadPool: jest.fn().mockReturnValue(null),
  setBatchThreadPool: jest.fn(),
  broadcastBatchSpriteStatus: jest.fn()
};
