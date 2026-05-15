const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * 类似 Java Semaphore 的雪碧图任务管理器
 * 支持最多 5 个并发任务，超出的进入队列排队
 */
class SpriteTaskSemaphore extends EventEmitter {
  constructor(permits = 5, storagePath = null) {
    super();
    this.permits = permits;
    this.availablePermits = permits;
    this.queue = []; // 排队任务: {id, videoPath, options, taskFn, createdAt}
    this.activeTasks = new Map(); // 执行中任务: id -> {videoPath, abortController}
    this.taskStatusMap = new Map(); // 所有任务状态: id -> status
    this.nextTaskId = 1;
    this.storagePath = storagePath || path.join(__dirname, '..', 'data', 'sprite-tasks.json');

    // 尝试从文件加载历史状态
    this._loadFromStorage();
  }

  /**
   * 生成唯一任务ID
   */
  generateTaskId() {
    return `task_${this.nextTaskId++}`;
  }

  /**
   * 提交任务到队列
   * @param {string} videoPath - 视频路径
   * @param {object} options - 生成选项
   * @param {Function} taskFn - 任务执行函数 (abortController, onProgress) => Promise
   * @param {object} extraStatus - 额外的状态信息 (videoId, videoTitle等)
   * @returns {string} taskId
   */
  submit(videoPath, options, taskFn, extraStatus = {}) {
    const taskId = this.generateTaskId();
    const now = Date.now();

    // 创建任务状态
    const status = {
      id: taskId,
      videoPath,
      status: 'pending',
      queuePosition: this.queue.length + 1,
      percent: 0,
      message: '排队中...',
      createdAt: now,
      updatedAt: now,
      ...extraStatus
    };

    // 存储任务信息
    const task = {
      id: taskId,
      videoPath,
      options,
      taskFn,
      extraStatus,
      createdAt: now
    };

    this.queue.push(task);
    this.taskStatusMap.set(taskId, status);

    console.log(`[Semaphore] 任务加入队列: ${taskId}, 当前队列长度: ${this.queue.length}`);

    // 清理旧的已完成任务，只保留最近10个
    this.cleanupOldStatuses(10);

    // 保存到文件
    this._saveToStorage();

    // 尝试启动任务
    this._processQueue();

    // 通知状态变化
    this.emit('statusChanged');

    return taskId;
  }

  /**
   * 尝试处理队列
   */
  _processQueue() {
    while (this.availablePermits > 0 && this.queue.length > 0) {
      const task = this.queue.shift();
      this._startTask(task);
    }

    // 更新排队中任务的位置
    this._updateQueuePositions();
  }

  /**
   * 开始执行任务
   */
  async _startTask(task) {
    this.availablePermits--;

    const abortController = new AbortController();
    const now = Date.now();

    // 更新状态为运行中
    const status = {
      ...this.taskStatusMap.get(task.id),
      status: 'running',
      message: '开始生成...',
      queuePosition: undefined,
      updatedAt: now
    };
    this.taskStatusMap.set(task.id, status);

    // 记录活跃任务
    this.activeTasks.set(task.id, {
      videoPath: task.videoPath,
      abortController
    });

    console.log(`[Semaphore] 开始执行任务: ${task.id}, 剩余许可: ${this.availablePermits}`);
    this.emit('statusChanged');

    // 执行任务
    try {
      const onProgress = (progress) => {
        const currentStatus = this.taskStatusMap.get(task.id);
        if (currentStatus && currentStatus.status !== 'aborted') {
          const updatedStatus = {
            ...currentStatus,
            percent: progress.percent || 0,
            message: progress.message || '处理中...',
            stage: progress.stage,
            frameCount: progress.frameCount,
            totalFrames: progress.totalFrames,
            updatedAt: Date.now()
          };
          this.taskStatusMap.set(task.id, updatedStatus);
          this._saveToStorage();
          this.emit('statusChanged');
        }
      };

      const result = await task.taskFn(abortController, onProgress);

      // 任务完成
      const finalStatus = {
        ...this.taskStatusMap.get(task.id),
        ...result,
        status: 'completed',
        percent: 100,
        message: '完成',
        updatedAt: Date.now()
      };
      this.taskStatusMap.set(task.id, finalStatus);
      console.log(`[Semaphore] 任务完成: ${task.id} (${finalStatus.videoTitle || finalStatus.videoPath})`);

    } catch (err) {
      // 检查是否是被中止的
      const currentStatus = this.taskStatusMap.get(task.id);
      if (currentStatus && currentStatus.status === 'aborted') {
        console.log(`[Semaphore] 任务已中止: ${task.id}`);
      } else {
        console.error(`[Semaphore] 任务失败: ${task.id}`, err);
        const errorStatus = {
          ...this.taskStatusMap.get(task.id),
          status: 'error',
          error: true,
          message: '生成失败: ' + err.message,
          updatedAt: Date.now()
        };
        this.taskStatusMap.set(task.id, errorStatus);
      }
    } finally {
      // 清理活跃任务
      this.activeTasks.delete(task.id);
      // 释放许可
      this.availablePermits++;
      console.log(`[Semaphore] 释放许可, 当前可用: ${this.availablePermits}`);
      // 清理旧的已结束任务状态（保留最近10个已完成的）
      this.cleanupOldStatuses(10);
      // 保存状态到文件
      this._saveToStorage();
      // 通知状态变化
      this.emit('statusChanged');
      // 继续处理队列
      this._processQueue();
    }
  }

  /**
   * 更新排队中任务的位置
   */
  _updateQueuePositions() {
    this.queue.forEach((task, index) => {
      const status = this.taskStatusMap.get(task.id);
      if (status) {
        status.queuePosition = index + 1;
        status.updatedAt = Date.now();
      }
    });
  }

  /**
   * 中止任务
   * @param {string} taskIdOrPath - 任务ID或视频路径
   * @returns {boolean} 是否成功中止
   */
  abort(taskIdOrPath) {
    // 先尝试按任务ID查找
    let taskId = taskIdOrPath;
    let foundTask = null;

    // 如果不是任务ID格式，尝试按视频路径查找
    if (!taskIdOrPath.startsWith('task_')) {
      // 1. 先在活跃任务中查找
      for (const [id, info] of this.activeTasks) {
        if (info.videoPath === taskIdOrPath) {
          taskId = id;
          break;
        }
      }
      // 2. 再在排队队列中查找
      if (taskId === taskIdOrPath) {
        const queuedTask = this.queue.find(t => t.videoPath === taskIdOrPath);
        if (queuedTask) {
          taskId = queuedTask.id;
        }
      }
      // 3. 最后在所有任务状态中查找（处理重启后的僵尸任务）
      if (taskId === taskIdOrPath) {
        for (const [id, status] of this.taskStatusMap) {
          if (status.videoPath === taskIdOrPath) {
            taskId = id;
            foundTask = status;
            break;
          }
        }
      }
    }

    const status = foundTask || this.taskStatusMap.get(taskId);
    if (!status) {
      console.log(`[Semaphore] 未找到任务: ${taskIdOrPath}`);
      return false;
    }

    // 如果任务已经是中止状态，直接返回成功
    if (status.status === 'aborted' || status.status === 'completed' || status.status === 'error') {
      console.log(`[Semaphore] 任务已是终态 (${status.status}): ${taskId}`);
      return true;
    }

    if (status.status === 'pending') {
      // 从排队队列中移除
      const index = this.queue.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.queue.splice(index, 1);
        console.log(`[Semaphore] 从队列移除任务: ${taskId}`);
      }

      // 更新状态
      status.status = 'aborted';
      status.message = '已中止';
      status.queuePosition = undefined;
      status.updatedAt = Date.now();

      this._updateQueuePositions();
      this._saveToStorage();
      this.emit('statusChanged');
      return true;
    }

    if (status.status === 'running') {
      // 中止正在运行的任务
      const activeTask = this.activeTasks.get(taskId);
      if (activeTask) {
        activeTask.abortController.abort();
        console.log(`[Semaphore] 发送中止信号: ${taskId}`);
      } else {
        console.log(`[Semaphore] 任务 ${taskId} 标记为运行中但不在活跃列表，直接设为中止`);
      }

      // 更新状态
      status.status = 'aborted';
      status.message = '已中止';
      status.updatedAt = Date.now();
      this._saveToStorage();

      this.emit('statusChanged');
      return true;
    }

    console.log(`[Semaphore] 任务无法中止 (状态: ${status.status}): ${taskId}`);
    return false;
  }

  /**
   * 获取所有任务状态
   * @returns {Array} 状态数组
   */
  getAllStatuses() {
    return Array.from(this.taskStatusMap.values());
  }

  /**
   * 获取当前正在运行的任务数量
   */
  getActiveCount() {
    return this.activeTasks.size;
  }

  /**
   * 获取当前排队的任务数量
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * 清除已完成的任务状态
   * 规则：
   * 1. running 和 pending 状态的任务永远保留
   * 2. completed 状态的任务只保留最近的 10 个
   * 3. error 和 aborted 状态直接删除
   */
  cleanupOldStatuses(keepCompletedCount = 10) {
    // 直接从 taskStatusMap 获取，避免调用 getAllStatuses 导致死循环
    const allStatuses = Array.from(this.taskStatusMap.values());

    console.log(`[Semaphore] 开始清理，当前共 ${allStatuses.length} 个任务`);

    // 1. 分离不同状态的任务
    const runningOrPending = allStatuses.filter(s => s.status === 'running' || s.status === 'pending');
    const completed = allStatuses.filter(s => s.status === 'completed');

    console.log(`[Semaphore] 其中 running/pending: ${runningOrPending.length}, completed: ${completed.length}`);

    // 2. 先清空 taskStatusMap
    this.taskStatusMap.clear();

    // 3. 重新添加所有 running/pending
    for (const s of runningOrPending) {
      this.taskStatusMap.set(s.id, s);
    }

    // 4. completed 按时间倒序排序（最新的在前），只保留最近 10 个
    if (completed.length > 0) {
      const sortByTime = (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      const sortedCompleted = [...completed].sort(sortByTime); // 拷贝一份再排序
      const keptCompleted = sortedCompleted.slice(0, keepCompletedCount);

      // 打印每个任务的时间，方便调试
      console.log(`[Semaphore] completed 任务时间排序：`);
      sortedCompleted.forEach((s, i) => {
        const time = new Date(s.updatedAt || s.createdAt).toLocaleTimeString();
        console.log(`  ${i+1}. ${s.videoTitle || s.videoPath} - ${time} ${i < keepCompletedCount ? '[保留]' : '[删除]'}`);
      });

      for (const s of keptCompleted) {
        this.taskStatusMap.set(s.id, s);
      }

      console.log(`[Semaphore] completed 保留了 ${keptCompleted.length} 个，删除了 ${completed.length - keptCompleted.length} 个`);
    }

    console.log(`[Semaphore] 清理完成，当前共 ${this.taskStatusMap.size} 个任务`);
  }

  /**
   * 检查视频是否正在处理或排队中
   */
  isVideoInQueueOrRunning(videoPath) {
    // 检查活跃任务
    for (const info of this.activeTasks.values()) {
      if (info.videoPath === videoPath) {
        return true;
      }
    }
    // 检查排队队列
    return this.queue.some(t => t.videoPath === videoPath);
  }

  /**
   * 根据视频路径获取任务状态
   */
  getStatusByVideoPath(videoPath) {
    for (const status of this.taskStatusMap.values()) {
      if (status.videoPath === videoPath) {
        return status;
      }
    }
    return null;
  }

  /**
   * 从文件加载历史状态
   */
  _loadFromStorage() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
        if (data.tasks && Array.isArray(data.tasks)) {
          let abortedCount = 0;
          for (const task of data.tasks) {
            if (task.id) {
              // 服务器重启时，所有正在运行或排队的任务都应该被标记为已中止
              if (task.status === 'running' || task.status === 'pending') {
                task.status = 'aborted';
                task.message = task.message ? `${task.message} (服务重启)` : '服务重启，任务已中止';
                task.queuePosition = undefined;
                task.updatedAt = Date.now();
                abortedCount++;
              }
              this.taskStatusMap.set(task.id, task);
            }
          }
          if (data.nextTaskId) {
            this.nextTaskId = data.nextTaskId;
          }
          console.log(`[Semaphore] 从文件加载了 ${this.taskStatusMap.size} 个历史任务，其中 ${abortedCount} 个进行中的任务已标记为中止`);

          // 清理旧的已完成任务，只保留最近10个
          this.cleanupOldStatuses(10);

          // 保存修正后的状态
          if (abortedCount > 0) {
            this._saveToStorage();
          }
        }
      }
    } catch (err) {
      console.error('[Semaphore] 加载历史任务失败:', err);
    }
  }

  /**
   * 保存状态到文件
   */
  _saveToStorage() {
    try {
      // 确保目录存在
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        nextTaskId: this.nextTaskId,
        tasks: Array.from(this.taskStatusMap.values())
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Semaphore] 保存任务失败:', err);
    }
  }

  /**
   * 清除所有已完成的任务（保留进行中的）
   */
  clearCompletedTasks() {
    const toDelete = [];
    for (const [id, status] of this.taskStatusMap.entries()) {
      if (status.status === 'completed' || status.status === 'error' || status.status === 'aborted') {
        // 不删除正在进行或排队中的
        toDelete.push(id);
      }
    }
    toDelete.forEach(id => this.taskStatusMap.delete(id));
    this._saveToStorage();
    this.emit('statusChanged');
    console.log(`[Semaphore] 清除了 ${toDelete.length} 个已完成任务`);
  }
}

module.exports = SpriteTaskSemaphore;
