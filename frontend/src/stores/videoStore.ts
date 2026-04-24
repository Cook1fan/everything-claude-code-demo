import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Video, VideoData, ScanStatus, DirectoryTreeNode, SpriteInfo, SpriteStatus, BatchSpriteStats } from '@/types'
import * as indexedDB from '@/utils/indexedDB'

const API_BASE = '/api'

export type SortMode = 'default' | 'random' | 'name' | 'date'

export const useVideoStore = defineStore('video', () => {
  const videos = ref<Video[]>([])
  const hardDrives = ref<string[]>([])
  const directories = ref<string[]>([])
  const directoryTree = ref<DirectoryTreeNode[]>([])
  const loading = ref(false)
  const scanning = ref(false)
  const lastScan = ref<number | null>(null)
  const videoCount = ref(0)
  const selectedDirectory = ref<string>('')
  const searchQuery = ref<string>('')
  const recentVideos = ref<string[]>([])
  const expandedNodes = ref<Set<string>>(new Set())
  const sortMode = ref<SortMode>('random')
  const randomSeed = ref<number>(Date.now())
  const currentPage = ref(1)
  const pageSize = 100
  const isInitialized = ref(false)

  // 雪碧图生成状态 - 支持多个同时生成
  const spriteInProgressSet = ref<Set<string>>(new Set())
  const spriteStatusMap = ref<Map<string, SpriteStatus>>(new Map())

  // 批量雪碧图生成状态
  const batchSpriteInProgress = ref(false)
  const batchSpriteStats = ref<BatchSpriteStats | null>(null)

  let ws: WebSocket | null = null
  let reconnectTimer: number | null = null

  // 兼容旧的单个状态接口
  const spriteInProgress = computed(() => spriteInProgressSet.value.size > 0)
  const spriteStatus = computed(() => {
    // 返回第一个状态或者 null
    const firstStatus = Array.from(spriteStatusMap.value.values())[0]
    return firstStatus || null
  })

  // 连接 WebSocket
  function connectWebSocket() {
    if (ws) return

    // 开发环境直接连接后端端口，生产环境使用当前 host
    const isDev = import.meta.env.DEV
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = isDev ? 'localhost:3000' : window.location.host
    const wsUrl = `${protocol}//${host}`

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket 已连接')
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'spriteStatus') {
            // 不清空整个 Map，只更新收到的状态
            const newInProgressSet = new Set<string>()
            if (message.data.allStatus && Array.isArray(message.data.allStatus)) {
              // 先添加/更新所有状态
              for (const status of message.data.allStatus) {
                if (status.videoPath) {
                  spriteStatusMap.value.set(status.videoPath, status)
                  if (status.percent != null && status.percent < 100 && !status.error) {
                    newInProgressSet.add(status.videoPath)
                  }
                  // 保存到 IndexedDB
                  try {
                    await indexedDB.putSpriteTask(status)
                  } catch (err) {
                    console.error('保存雪碧图任务到 IndexedDB 失败:', err)
                  }
                }
              }

              // 统一清理：超过5个时优先删除最先完成的
              const allStatuses = Array.from(spriteStatusMap.value.values())
              if (allStatuses.length > 5) {
                // 分成两组：已完成的和进行中的
                const completed = allStatuses.filter(s =>
                  (s.percent != null && s.percent >= 100) || s.error
                )
                const inProgress = allStatuses.filter(s =>
                  s.percent != null && s.percent < 100 && !s.error
                )

                // 先对已完成的按完成时间排序（最老的在前）
                completed.sort((a, b) => (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0))

                // 计算需要删除多少个
                const needToDelete = allStatuses.length - 5

                // 优先删除已完成的最老的
                const toDelete = completed.slice(0, needToDelete)

                // 如果已完成的不够删，则从进行中的删除最老的（理论上不应该发生）
                if (toDelete.length < needToDelete) {
                  inProgress.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                  toDelete.push(...inProgress.slice(0, needToDelete - toDelete.length))
                }

                // 执行删除
                for (const status of toDelete) {
                  if (status.videoPath) {
                    spriteStatusMap.value.delete(status.videoPath)
                  }
                }
              }
            }
            spriteInProgressSet.value = newInProgressSet
          } else if (message.type === 'batchSpriteStatus') {
            batchSpriteStats.value = message.data
            batchSpriteInProgress.value = message.data.isRunning
          } else if (message.type === 'scanStatus') {
            // 处理扫描状态变更通知
            scanning.value = message.data.scanning
            if (!message.data.scanning && message.data.success) {
              videoCount.value = message.data.videoCount || 0
              // 扫描完成后自动刷新视频列表
              loadVideos()
            }
          }
        } catch (err) {
          console.error('解析 WebSocket 消息失败:', err)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket 已断开，尝试重连...')
        ws = null
        // 5秒后重连
        reconnectTimer = window.setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }

      ws.onerror = (err) => {
        console.error('WebSocket 错误:', err)
      }
    } catch (err) {
      console.error('创建 WebSocket 连接失败:', err)
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

  // 从 IndexedDB 加载状态
  async function loadStateFromDB() {
    try {
      const state = await indexedDB.getAppState()
      recentVideos.value = state.recentVideos || []
      expandedNodes.value = new Set(state.expandedNodes || [])
      sortMode.value = (state.sortMode as SortMode) || 'random'
      selectedDirectory.value = state.selectedDirectory || ''
      searchQuery.value = state.searchQuery || ''
      currentPage.value = state.currentPage || 1
    } catch (err) {
      console.error('加载应用状态失败:', err)
    }
  }

  // 保存状态到 IndexedDB
  async function saveStateToDB() {
    try {
      await indexedDB.putAppState({
        recentVideos: recentVideos.value,
        expandedNodes: Array.from(expandedNodes.value),
        sortMode: sortMode.value,
        selectedDirectory: selectedDirectory.value,
        searchQuery: searchQuery.value,
        currentPage: currentPage.value,
      })
    } catch (err) {
      console.error('保存应用状态失败:', err)
    }
  }

  // 从 IndexedDB 加载雪碧图任务
  async function loadSpriteTasksFromDB() {
    try {
      const tasks = await indexedDB.getSpriteTasks()
      for (const task of tasks) {
        if (task.videoPath) {
          spriteStatusMap.value.set(task.videoPath, task)
          if (task.percent != null && task.percent < 100 && !task.error) {
            spriteInProgressSet.value.add(task.videoPath)
          }
        }
      }
    } catch (err) {
      console.error('从 IndexedDB 加载雪碧图任务失败:', err)
    }
  }

  // 初始化 store
  async function initialize() {
    if (isInitialized.value) return
    await loadStateFromDB()
    await loadSpriteTasksFromDB()
    connectWebSocket()
    isInitialized.value = true
  }

  // 洗牌算法
  function shuffleArray<T>(array: T[], seed: number): T[] {
    const result = [...array]
    let s = seed
    for (let i = result.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      const j = s % (i + 1)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  const filteredVideos = computed(() => {
    // 确保 videos.value 是数组
    let result = Array.isArray(videos.value) ? [...videos.value] : []

    if (selectedDirectory.value) {
      // 显示选中目录及其所有子目录下的视频
      result = result.filter(v => {
        // 检查视频目录是否等于选中目录，或是选中目录的子目录
        return v.directory === selectedDirectory.value ||
               v.directory.startsWith(selectedDirectory.value + '/')
      })
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(v =>
        v.title.toLowerCase().includes(query)
      )
    }

    switch (sortMode.value) {
      case 'random':
        result = shuffleArray(result, randomSeed.value)
        break
      case 'name':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'date':
        result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        break
      default:
        result.sort((a, b) => {
          if (a.directory !== b.directory) {
            return a.directory.localeCompare(b.directory)
          }
          return a.title.localeCompare(b.title)
        })
    }

    return result
  })

  const totalPages = computed(() => Math.ceil(filteredVideos.value.length / pageSize))

  const pagedVideos = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    return filteredVideos.value.slice(start, end)
  })

  function goToPage(page: number) {
    currentPage.value = Math.max(1, Math.min(page, totalPages.value))
    saveStateToDB()
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++
      saveStateToDB()
    }
  }

  function prevPage() {
    if (currentPage.value > 1) {
      currentPage.value--
      saveStateToDB()
    }
  }

  function toggleNode(path: string) {
    if (expandedNodes.value.has(path)) {
      expandedNodes.value.delete(path)
    } else {
      expandedNodes.value.add(path)
    }
    saveStateToDB()
  }

  function isExpanded(path: string) {
    return expandedNodes.value.has(path)
  }

  function expandToPath(path: string) {
    const parts = path.split('/')
    let current = ''
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        current = current ? current + '/' + parts[i] : parts[i]
        expandedNodes.value.add(current)
      }
    }
    saveStateToDB()
  }

  function selectDirectory(path: string) {
    selectedDirectory.value = path
    currentPage.value = 1
    saveStateToDB()
  }

  function setSortMode(mode: SortMode) {
    sortMode.value = mode
    currentPage.value = 1
    if (mode === 'random') {
      randomSeed.value = Date.now()
    }
    saveStateToDB()
  }

  function reshuffle() {
    randomSeed.value = Date.now()
    currentPage.value = 1
  }

  async function loadVideos() {
    loading.value = true
    try {
      const res = await fetch(`${API_BASE}/videos`)
      const data: VideoData = await res.json()
      videos.value = Array.isArray(data.videos) ? data.videos : []
      hardDrives.value = Array.isArray(data.hardDrives) ? data.hardDrives : []
      directories.value = Array.isArray(data.directories) ? data.directories : []
      directoryTree.value = Array.isArray(data.directoryTree) ? data.directoryTree : []
    } catch (err) {
      console.error('加载视频失败:', err)
      // 出错时设置为空数组
      videos.value = []
      hardDrives.value = []
      directories.value = []
      directoryTree.value = []
    } finally {
      loading.value = false
    }
  }

  async function getScanStatus() {
    try {
      const res = await fetch(`${API_BASE}/scan/status`)
      const data: ScanStatus = await res.json()
      scanning.value = data.scanning
      lastScan.value = data.lastScan
      videoCount.value = data.videoCount
    } catch (err) {
      console.error('获取扫描状态失败:', err)
    }
  }

  async function startScan() {
    try {
      const res = await fetch(`${API_BASE}/scan`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        scanning.value = true
      }
      return data
    } catch (err) {
      console.error('启动扫描失败:', err)
    }
  }

  function getVideoUrl(video: Video) {
    return `${API_BASE}/video?path=${encodeURIComponent(video.videoPath)}`
  }

  function getImageUrl(video: Video) {
    if (!video.posterPath) return ''
    return `${API_BASE}/image?path=${encodeURIComponent(video.posterPath)}`
  }

  function getSpriteUrl(video: Video) {
    if (!video.spritePath) return ''
    return `${API_BASE}/image?path=${encodeURIComponent(video.spritePath)}`
  }

  async function checkFFmpegStatus() {
    try {
      const res = await fetch(`${API_BASE}/ffmpeg/status`)
      return await res.json()
    } catch (err) {
      console.error('检查 FFmpeg 状态失败:', err)
      return { available: false, message: '检查失败' }
    }
  }

  async function generateSprite(videoPath: string, force: boolean = false) {
    try {
      const res = await fetch(`${API_BASE}/sprite/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: videoPath, force }),
      })
      return await res.json()
    } catch (err) {
      console.error('生成雪碧图失败:', err)
      return { success: false, message: '请求失败' }
    }
  }

  async function getSpriteStatus() {
    try {
      const res = await fetch(`${API_BASE}/sprite/status`)
      return await res.json()
    } catch (err) {
      console.error('获取雪碧图状态失败:', err)
      return { inProgress: false, status: null }
    }
  }

  async function getSpriteInfo(spritePath: string): Promise<SpriteInfo | null> {
    try {
      const res = await fetch(`${API_BASE}/sprite/info?path=${encodeURIComponent(spritePath)}`)
      if (!res.ok) return null
      return await res.json()
    } catch (err) {
      console.error('获取雪碧图信息失败:', err)
      return null
    }
  }

  async function batchGenerateSprites(videoPaths: string[], force: boolean = false, poolSize?: number) {
    try {
      const res = await fetch(`${API_BASE}/sprite/batch-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: videoPaths, force, poolSize }),
      })
      return await res.json()
    } catch (err) {
      console.error('批量生成雪碧图失败:', err)
      return { success: false, message: '请求失败' }
    }
  }

  async function getBatchSpriteStatus() {
    try {
      const res = await fetch(`${API_BASE}/sprite/batch-status`)
      return await res.json()
    } catch (err) {
      console.error('获取批量生成状态失败:', err)
      return { isRunning: false, stats: null }
    }
  }

  async function abortBatchSprites() {
    try {
      const res = await fetch(`${API_BASE}/sprite/batch-abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      return await res.json()
    } catch (err) {
      console.error('中止批量生成失败:', err)
      return { success: false, message: '请求失败' }
    }
  }

  // 清除所有雪碧图任务
  async function clearAllSpriteTasks() {
    spriteStatusMap.value.clear()
    spriteInProgressSet.value.clear()
    try {
      await indexedDB.clearSpriteTasks()
    } catch (err) {
      console.error('清除雪碧图任务失败:', err)
    }
  }

  function addToRecent(videoId: string) {
    const recent = recentVideos.value.filter(id => id !== videoId)
    recent.unshift(videoId)
    recentVideos.value = recent.slice(0, 20)
    saveStateToDB()
  }

  function formatFileSize(bytes?: number) {
    if (!bytes) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  return {
    videos,
    hardDrives,
    directories,
    directoryTree,
    loading,
    scanning,
    lastScan,
    videoCount,
    selectedDirectory,
    searchQuery,
    recentVideos,
    expandedNodes,
    sortMode,
    randomSeed,
    currentPage,
    pageSize,
    isInitialized,
    filteredVideos,
    totalPages,
    pagedVideos,
    spriteInProgress,
    spriteStatus,
    spriteInProgressSet,
    spriteStatusMap,
    batchSpriteInProgress,
    batchSpriteStats,
    initialize,
    toggleNode,
    isExpanded,
    expandToPath,
    selectDirectory,
    setSortMode,
    reshuffle,
    goToPage,
    nextPage,
    prevPage,
    loadVideos,
    getScanStatus,
    startScan,
    getVideoUrl,
    getImageUrl,
    getSpriteUrl,
    checkFFmpegStatus,
    generateSprite,
    getSpriteStatus,
    getSpriteInfo,
    batchGenerateSprites,
    getBatchSpriteStatus,
    abortBatchSprites,
    addToRecent,
    formatFileSize,
    connectWebSocket,
    disconnectWebSocket,
    clearAllSpriteTasks,
    shuffleArray,
  }
})
