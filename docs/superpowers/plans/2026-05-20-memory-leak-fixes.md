# 内存问题分析与整改方案

## 问题概述
项目运行或生成雪碧图后，电脑内存占用居高不下，表明存在内存泄漏或资源管理不当的问题。

---

## 一、前端内存问题分析

### 1.1 Pinia Store (`videoStore.ts`) - 关键问题

#### 问题 1.1.1: WebSocket 连接和重连定时器未正确清理
**位置**: `frontend/src/stores/videoStore.ts` 第 53-232 行
**问题描述**:
- WebSocket 连接仅在 `disconnectWebSocket()` 中清理，但该函数从未在 store 销毁时自动调用
- 重连定时器（第 209-211 行）使用 `window.setTimeout()`，同样只在 `disconnectWebSocket()` 中清理

**影响**: WebSocket 连接会持续存在，定时器会继续触发，即使组件已卸载

**解决方案**:
```typescript
// 在 videoStore.ts 中添加销毁钩子
export const useVideoStore = defineStore('video', () => {
  // ... 现有代码 ...

  // 添加 cleanup 方法
  function cleanup() {
    disconnectWebSocket()
    if (refreshVideosTimer) {
      clearTimeout(refreshVideosTimer)
    }
  }

  return {
    // ... 现有返回 ...
    cleanup
  }
})
```

---

#### 问题 1.1.2: `spriteStatusMap` 可能无限增长
**位置**: `frontend/src/stores/videoStore.ts` 第 12-42 行、第 118-145 行
**问题描述**:
- 虽然有限制 10 个已完成任务的逻辑，但仅在新任务完成时运行
- 没有定期清理机制，极端情况下仍可能堆积
- `expandedNodes` Map 也可能无限增长

**解决方案**:
```typescript
// 添加定期清理机制
const MAX_COMPLETED_TASKS = 10
const MAX_STORED_TASKS = 50 // 绝对上限

function cleanupSpriteStatusMap() {
  const allStatus = Array.from(spriteStatusMap.value.values())
  const completed = allStatus.filter(s => 
    s.status === 'completed' || s.status === 'error' || s.status === 'aborted'
  )
  const inProgress = allStatus.filter(s => 
    s.status === 'running' || s.status === 'pending'
  )

  if (allStatus.length > MAX_STORED_TASKS) {
    // 超过绝对上限，强制清理
    const sorted = [...completed].sort((a, b) => 
      (b.createdAt || 0) - (a.createdAt || 0)
    )
    const toKeep = sorted.slice(0, MAX_COMPLETED_TASKS)
    const toKeepIds = new Set([...toKeep, ...inProgress].map(s => s.id))
    
    for (const [id, status] of spriteStatusMap.value) {
      if (!toKeepIds.has(id)) {
        spriteStatusMap.value.delete(id)
      }
    }
  }
}
```

---

### 1.2 VideoView.vue - 显著内存风险

#### 问题 1.2.1: Plyr 播放器事件监听器未正确移除
**位置**: `frontend/src/views/VideoView.vue` 第 708-789 行
**问题描述**:
- 向 Plyr 添加了多个事件监听器，但在销毁播放器前未移除它们
- Plyr 内部可能持有这些监听器的引用，导致整个组件无法被 GC

**解决方案**:
```typescript
// 在 loadPlayer 中保存监听器引用
const playerEventListeners = new Map()

function loadPlayer() {
  // ... 现有代码 ...
  
  // 保存每个监听器的引用
  const playHandler = () => { /* ... */ }
  playerEventListeners.set('play', playHandler)
  player.value.on('play', playHandler)
  
  const pauseHandler = () => { /* ... */ }
  playerEventListeners.set('pause', pauseHandler)
  player.value.on('pause', pauseHandler)
  
  // ... 其他监听器 ...
}

// 在 cleanup 中移除所有监听器
function cleanupPlayer() {
  if (player.value) {
    // 移除所有保存的监听器
    for (const [event, handler] of playerEventListeners) {
      try {
        player.value.off(event, handler)
      } catch {}
    }
    playerEventListeners.clear()
    
    // 然后再销毁播放器
    player.value.destroy()
    player.value = null
  }
}
```

---

#### 问题 1.2.2: Blob URL 和图像资源未完全释放
**位置**: `frontend/src/views/VideoView.vue` 第 589-636 行、第 806-817 行
**问题描述**:
- `URL.createObjectURL()` 创建的 Blob URL 需要显式 revoke
- Image 对象虽然设置为 null，但浏览器缓存可能仍持有大位图数据

**解决方案**:
```typescript
// 更激进的资源清理
function cleanupVttBlobUrl() {
  if (currentVttBlobUrl.value) {
    URL.revokeObjectURL(currentVttBlobUrl.value)
    currentVttBlobUrl.value = null
  }
}

function cleanupSpriteImage() {
  if (spriteImage.value) {
    // 移除图像所有引用
    spriteImage.value.src = ''
    spriteImage.value.onload = null
    spriteImage.value.onerror = null
    spriteImage.value = null
  }
}

// 在 onBeforeUnmount 中按顺序调用
onBeforeUnmount(() => {
  // ... 现有清理 ...
  cleanupSpriteImage()
  cleanupVttBlobUrl()
})
```

---

### 1.3 前端通用问题

#### 问题 1.3.1: 缺少统一的资源管理策略
**问题描述**: 各个组件各自管理资源，没有统一的模式

**解决方案**: 创建资源管理工具函数
```typescript
// frontend/src/utils/resourceManager.ts
export class ResourceManager {
  private timers: Set<number> = new Set()
  private blobUrls: Set<string> = new Set()
  private eventListeners: Map<EventTarget, Map<string, EventListener>> = new Map()
  private cleanups: Set<() => void> = new Set()

  addTimer(timerId: number) {
    this.timers.add(timerId)
  }

  removeTimer(timerId: number) {
    clearTimeout(timerId)
    this.timers.delete(timerId)
  }

  addBlobUrl(url: string) {
    this.blobUrls.add(url)
  }

  revokeBlobUrl(url: string) {
    URL.revokeObjectURL(url)
    this.blobUrls.delete(url)
  }

  addEventListener(target: EventTarget, event: string, handler: EventListener) {
    target.addEventListener(event, handler)
    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, new Map())
    }
    this.eventListeners.get(target)!.set(event, handler)
  }

  addCleanup(fn: () => void) {
    this.cleanups.add(fn)
  }

  cleanup() {
    // 清理所有定时器
    for (const timerId of this.timers) {
      clearTimeout(timerId)
      clearInterval(timerId)
    }
    this.timers.clear()

    // 清理所有 Blob URL
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url)
    }
    this.blobUrls.clear()

    // 清理所有事件监听器
    for (const [target, listeners] of this.eventListeners) {
      for (const [event, handler] of listeners) {
        target.removeEventListener(event, handler)
      }
    }
    this.eventListeners.clear()

    // 执行自定义清理函数
    for (const cleanup of this.cleanups) {
      try {
        cleanup()
      } catch {}
    }
    this.cleanups.clear()
  }
}

export function createResourceManager() {
  return new ResourceManager()
}
```

---

## 二、后端内存问题分析

### 2.1 SpriteTaskSemaphore.js - 无限制任务状态存储

#### 问题 2.1.1: `taskStatusMap` 可能无限增长
**位置**: `server/SpriteTaskSemaphore.js` 第 36-68 行、第 330-371 行
**问题描述**:
- 所有任务状态都存储在内存中
- `cleanupOldStatuses` 仅在特定操作时显式调用

**解决方案**:
```javascript
// 添加自动定期清理
const MAX_TASK_AGE = 30 * 60 * 1000 // 30 分钟
const MAX_TOTAL_TASKS = 100 // 绝对上限
let cleanupInterval = null

function startPeriodicCleanup() {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    cleanupOldStatuses()
  }, 5 * 60 * 1000) // 每 5 分钟清理一次
}

function stopPeriodicCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

function cleanupOldStatuses() {
  const now = Date.now()
  let cleanupCount = 0

  // 首先按时间清理
  for (const [id, status] of taskStatusMap) {
    const ended = ['completed', 'error', 'aborted'].includes(status.status)
    if (ended && (now - (status.endedAt || status.createdAt || now)) > MAX_TASK_AGE) {
      taskStatusMap.delete(id)
      cleanupCount++
    }
  }

  // 如果仍超过绝对上限，继续清理最旧的
  if (taskStatusMap.size > MAX_TOTAL_TASKS) {
    const entries = Array.from(taskStatusMap.entries())
      .filter(([_, s]) => ['completed', 'error', 'aborted'].includes(s.status))
      .sort((a, b) => (a[1].endedAt || a[1].createdAt || 0) - (b[1].endedAt || b[1].createdAt || 0))

    const toDelete = entries.slice(0, entries.length - MAX_TOTAL_TASKS)
    for (const [id] of toDelete) {
      taskStatusMap.delete(id)
      cleanupCount++
    }
  }

  console.log(`[Semaphore] 清理完成，删除 ${cleanupCount} 个任务，当前共 ${taskStatusMap.size} 个任务`)
}

// 在模块加载时启动定期清理
startPeriodicCleanup()
```

---

### 2.2 临时目录和进程跟踪 - 清理不完整

#### 问题 2.2.1: 临时目录清理可能失败
**位置**: `scanner/spriteGenerator.js` 第 92-120 行、第 594-595 行
**问题描述**:
- `cleanupTempDir` 在 finally 块中调用，但如果清理过程本身出错，可能导致临时文件残留
- 进程突然终止时，临时文件不会被清理

**解决方案**:
```javascript
// 改进临时目录清理
const fs = require('fs-extra')
const path = require('path')

const TEMP_DIRS = new Set()

// 注册所有创建的临时目录
function registerTempDir(dir) {
  TEMP_DIRS.add(dir)
}

function cleanupAllTempDirs() {
  console.log('[SpriteGenerator] 清理所有临时目录...')
  for (const dir of TEMP_DIRS) {
    try {
      if (fs.existsSync(dir)) {
        fs.removeSync(dir)
        console.log(`[SpriteGenerator] 已删除临时目录: ${dir}`)
      }
    } catch (err) {
      console.error(`[SpriteGenerator] 删除临时目录失败 ${dir}:`, err)
    }
  }
  TEMP_DIRS.clear()
}

// 在进程退出时清理
process.on('exit', cleanupAllTempDirs)
process.on('SIGINT', () => {
  cleanupAllTempDirs()
  process.exit(0)
})
process.on('SIGTERM', () => {
  cleanupAllTempDirs()
  process.exit(0)
})
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err)
  cleanupAllTempDirs()
  process.exit(1)
})
```

---

#### 问题 2.2.2: `runningProcesses` Map 可能遗留条目
**位置**: `scanner/spriteGenerator.js` 第 8 行
**问题描述**:
- 如果 worker 线程崩溃或被强制终止，条目可能永远保留在 Map 中

**解决方案**:
```javascript
// 添加超时检查
const PROCESS_TIMEOUT = 30 * 60 * 1000 // 30 分钟

function cleanupStaleProcesses() {
  const now = Date.now()
  for (const [videoPath, entry] of runningProcesses) {
    if (now - entry.startedAt > PROCESS_TIMEOUT) {
      console.warn(`[SpriteGenerator] 清理超时进程: ${videoPath}`)
      try {
        entry.process.kill('SIGKILL')
      } catch {}
      runningProcesses.delete(videoPath)
    }
  }
}

// 定期检查
setInterval(cleanupStaleProcesses, 5 * 60 * 1000)
```

---

### 2.3 cache.js - 内存缓存无过期

#### 问题 2.3.1: `videoDataCache` 无限期持有大量数据
**位置**: `server/middleware/cache.js` 第 5-33 行
**问题描述**:
- 缓存有 60 秒 TTL 的注释，但实际并未实现过期机制
- 整个视频库一直保存在内存中

**解决方案**:
```javascript
// 实现真正的带过期的缓存
let videoDataCache = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 1000 // 60 秒

function getCachedVideoData() {
  if (!videoDataCache) return null
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    clearVideoCache()
    return null
  }
  return videoDataCache
}

function setCachedVideoData(data) {
  clearVideoCache()
  videoDataCache = data
  cacheTimestamp = Date.now()
  
  // 设置自动过期
  setTimeout(() => {
    if (videoDataCache === data) {
      clearVideoCache()
    }
  }, CACHE_TTL)
}

function clearVideoCache() {
  if (videoDataCache) {
    // 帮助 GC
    if (Array.isArray(videoDataCache.videos)) {
      videoDataCache.videos.length = 0
    }
    videoDataCache = null
  }
  cacheTimestamp = 0
}

// 导出新的函数
module.exports = {
  getCachedVideoData,
  setCachedVideoData,
  clearVideoCache
}
```

---

### 2.4 WebSocket 客户端集合 - 连接泄漏

#### 问题 2.4.1: `clients` Set 可能累积断开的连接
**位置**: `server/websocket.js` 第 6 行
**问题描述**:
- 网络错误或突然断开可能不会正确触发 `close` 事件

**解决方案**:
```javascript
// 添加心跳检测
const HEARTBEAT_INTERVAL = 30 * 1000 // 30 秒
const HEARTBEAT_TIMEOUT = 10 * 1000 // 10 秒

const clients = new Set()
const clientTimestamps = new Map()

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server })

  wss.on('connection', (ws) => {
    clients.add(ws)
    clientTimestamps.set(ws, Date.now())

    // 心跳检测
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const sentAt = Date.now()
        ws.ping()
        
        // 设置超时
        const timeout = setTimeout(() => {
          if (clientTimestamps.get(ws) < sentAt) {
            // 未收到 pong，关闭连接
            console.log('[WebSocket] 客户端心跳超时，关闭连接')
            ws.close()
          }
        }, HEARTBEAT_TIMEOUT)
        
        ws._heartbeatTimeout = timeout
      }
    }, HEARTBEAT_INTERVAL)
    
    ws._heartbeat = heartbeat

    ws.on('pong', () => {
      clientTimestamps.set(ws, Date.now())
      if (ws._heartbeatTimeout) {
        clearTimeout(ws._heartbeatTimeout)
      }
    })

    ws.on('close', () => {
      clients.delete(ws)
      clientTimestamps.delete(ws)
      if (ws._heartbeat) clearInterval(ws._heartbeat)
      if (ws._heartbeatTimeout) clearTimeout(ws._heartbeatTimeout)
    })

    ws.on('error', (err) => {
      console.error('[WebSocket] 错误:', err)
      clients.delete(ws)
      clientTimestamps.delete(ws)
      if (ws._heartbeat) clearInterval(ws._heartbeat)
      if (ws._heartbeatTimeout) clearTimeout(ws._heartbeatTimeout)
    })

    // ... 现有消息处理 ...
  })

  // 定期清理死连接
  setInterval(() => {
    const now = Date.now()
    for (const ws of clients) {
      const lastSeen = clientTimestamps.get(ws) || 0
      if (now - lastSeen > 2 * HEARTBEAT_INTERVAL) {
        console.log('[WebSocket] 清理死连接')
        ws.close()
        clients.delete(ws)
        clientTimestamps.delete(ws)
      }
    }
  }, HEARTBEAT_INTERVAL)
}
```

---

## 三、整改优先级

### 高优先级（必须立即修复）
1. **SpriteTaskSemaphore.js**: 实现任务状态定期清理 - 最可能导致内存持续增长
2. **cache.js**: 实现真正的缓存过期 - 可能持有大量数据
3. **VideoView.vue**: Plyr 事件监听器清理 - 可能导致整个组件无法回收

### 中优先级（应该尽快修复）
4. **videoStore.ts**: 添加 store 清理机制
5. **spriteGenerator.js**: 改进临时目录清理和进程跟踪
6. **websocket.js**: 添加心跳检测

### 低优先级（可以逐步优化）
7. 实现通用资源管理器
8. scan.js 增量扫描优化

---

## 四、验证方法

### 前端内存验证
1. 使用 Chrome DevTools Memory 面板
2. 记录堆快照，对比操作前后的对象数量
3. 监控 Performance 内存曲线，看是否持续增长
4. 使用Allocation Instrumentation追踪泄漏

### 后端内存验证
1. 使用 `process.memoryUsage()` 定期记录内存
2. 使用 `--inspect` 启动 Node 并用 Chrome DevTools 分析
3. 压力测试：批量生成 100+ 雪碧图，观察内存是否回落

---

## 五、文件修改清单

| 文件 | 修改内容 | 优先级 |
|------|----------|--------|
| `server/SpriteTaskSemaphore.js` | 添加定期清理任务状态 | 高 |
| `server/middleware/cache.js` | 实现缓存过期 | 高 |
| `frontend/src/views/VideoView.vue` | 清理 Plyr 事件监听器、图像和 Blob | 高 |
| `frontend/src/stores/videoStore.ts` | 添加 store 清理机制 | 中 |
| `scanner/spriteGenerator.js` | 改进临时文件和进程清理 | 中 |
| `server/websocket.js` | 添加心跳检测 | 中 |
| `frontend/src/utils/resourceManager.ts` | 新建资源管理器 | 低 |

