import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FrameExtractStatus, FrameExtractParams, FrameExtractRequest, FrameExtractResponse, FrameExtractListResponse } from '@/types'

const API_BASE = '/api'

export const useFrameExtractStore = defineStore('frameExtract', () => {
  // 任务状态存储
  const taskStatusMap = ref<Map<string, FrameExtractStatus>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  // WebSocket 连接
  let ws: WebSocket | null = null
  let reconnectTimer: number | null = null

  // 计算属性：所有任务（按时间倒序）
  const allTasks = computed((): FrameExtractStatus[] => {
    const tasks = Array.from(taskStatusMap.value.values())
    return tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  })

  // 计算属性：进行中的任务数
  const activeTasksCount = computed(() => {
    return Array.from(taskStatusMap.value.values()).filter(
      t => t.status === 'pending' || t.status === 'running'
    ).length
  })

  // 计算属性：是否有任务进行中
  const inProgress = computed(() => activeTasksCount.value > 0)

  // 连接 WebSocket
  function connectWebSocket() {
    if (ws) return

    const isDev = import.meta.env.DEV
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = isDev ? 'localhost:3000' : window.location.host
    const wsUrl = `${protocol}//${host}`

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('Frame Extract WebSocket 已连接')
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        // 连接后立即加载任务状态
        loadTaskStatus()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'frameExtractStatus') {
            const { taskId, task } = message.data
            if (taskId && task) {
              taskStatusMap.value.set(taskId, task)
            } else if (message.data.tasks) {
              // 初始加载所有任务
              const newMap = new Map<string, FrameExtractStatus>()
              for (const t of message.data.tasks) {
                if (t.id) {
                  newMap.set(t.id, t)
                }
              }
              taskStatusMap.value = newMap
            }
          }
        } catch (err) {
          console.error('解析 WebSocket 消息失败:', err)
        }
      }

      ws.onclose = () => {
        console.log('Frame Extract WebSocket 已断开，尝试重连...')
        ws = null
        reconnectTimer = window.setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }

      ws.onerror = (err) => {
        console.error('Frame Extract WebSocket 错误:', err)
      }
    } catch (err) {
      console.error('创建 Frame Extract WebSocket 连接失败:', err)
    }
  }

  // 断开 WebSocket
  function disconnectWebSocket() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
  }

  // 加载任务状态
  async function loadTaskStatus() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/frame-extract/status`)
      const data: FrameExtractListResponse = await res.json()
      const newMap = new Map<string, FrameExtractStatus>()
      if (Array.isArray(data.tasks)) {
        for (const task of data.tasks) {
          if (task.id) {
            newMap.set(task.id, task)
          }
        }
      }
      taskStatusMap.value = newMap
    } catch (err) {
      console.error('加载任务状态失败:', err)
      error.value = '加载任务状态失败'
    } finally {
      loading.value = false
    }
  }

  // 开始新的帧提取任务
  async function startTask(videoPath: string, params: FrameExtractParams): Promise<FrameExtractResponse> {
    error.value = null
    try {
      const reqBody: FrameExtractRequest = { videoPath, params }
      const res = await fetch(`${API_BASE}/frame-extract/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      const data: FrameExtractResponse = await res.json()
      if (data.success && data.taskId) {
        // 立即刷新任务状态
        await loadTaskStatus()
      }
      return data
    } catch (err) {
      console.error('启动任务失败:', err)
      error.value = '启动任务失败'
      return { success: false, message: '请求失败' }
    }
  }

  // 中止任务
  async function abortTask(taskId: string) {
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/frame-extract/abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const data = await res.json()
      // 立即刷新任务状态
      await loadTaskStatus()
      return data
    } catch (err) {
      console.error('中止任务失败:', err)
      error.value = '中止任务失败'
      return { success: false, message: '请求失败' }
    }
  }

  // 清除历史任务
  async function clearHistory(keepLast: number = 20) {
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/frame-extract/clear-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepLast }),
      })
      await res.json()
      // 立即刷新任务状态
      await loadTaskStatus()
    } catch (err) {
      console.error('清除历史任务失败:', err)
      error.value = '清除历史任务失败'
    }
  }

  // 下载任务结果
  function downloadTask(taskId: string, filename: string = 'frames.zip') {
    const url = `${API_BASE}/frame-extract/download/${encodeURIComponent(taskId)}`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // 获取单个任务
  function getTask(taskId: string): FrameExtractStatus | undefined {
    return taskStatusMap.value.get(taskId)
  }

  // 初始化 store
  function initialize() {
    connectWebSocket()
  }

  // 清理资源
  function cleanup() {
    disconnectWebSocket()
  }

  return {
    taskStatusMap,
    loading,
    error,
    allTasks,
    activeTasksCount,
    inProgress,
    connectWebSocket,
    disconnectWebSocket,
    loadTaskStatus,
    startTask,
    abortTask,
    clearHistory,
    downloadTask,
    getTask,
    initialize,
    cleanup,
  }
})
