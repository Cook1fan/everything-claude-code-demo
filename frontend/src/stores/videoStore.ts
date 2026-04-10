import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Video, VideoData, ScanStatus, DirectoryTreeNode, SpriteInfo } from '@/types'
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

  // 初始化 store
  async function initialize() {
    if (isInitialized.value) return
    await loadStateFromDB()
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
    expandToPath(path)
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
    addToRecent,
    formatFileSize,
  }
})
