import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VideoPlayRecord, VideoPlaySession, VideoTimestamp } from '@/types'
import * as indexedDB from '@/utils/indexedDB'

export const usePlayHistoryStore = defineStore('playHistory', () => {
  const playRecords = ref<Map<string, VideoPlayRecord>>(new Map())
  const currentSession = ref<VideoPlaySession | null>(null)
  const lastCountedVideoId = ref<string | null>(null)
  const isInitialized = ref(false)
  let sessionTimer: number | null = null

  // 会话开始时记录的初始总时长
  let initialTotalTime = 0
  // 暂停时已经播放的时长
  let pausedAccumulatedTime = 0

  /**
   * 从 IndexedDB 加载数据到内存
   */
  async function loadFromDB() {
    try {
      const records = await indexedDB.getAllRecords()
      playRecords.value = new Map(records.map(r => [r.videoId, r]))
    } catch (err) {
      console.error('加载播放历史失败:', err)
    }
  }

  /**
   * 保存单条记录到 IndexedDB
   */
  async function saveToDB(record: VideoPlayRecord) {
    try {
      await indexedDB.putRecord(record)
    } catch (err) {
      console.error('保存播放历史失败:', err)
    }
  }

  /**
   * 初始化 store（包括 IndexedDB 初始化和数据迁移）
   */
  async function initialize() {
    if (isInitialized.value) return

    try {
      await indexedDB.initDB()
      await loadFromDB()
      isInitialized.value = true
    } catch (err) {
      console.error('初始化播放历史 store 失败:', err)
    }
  }

  // 获取视频的播放记录
  function getRecord(videoId: string): VideoPlayRecord | undefined {
    return playRecords.value.get(videoId)
  }

  // 开始播放会话
  function startSession(videoId: string) {
    const now = Date.now()

    // 如果是同一个视频，并且已经有会话，检查是否是暂停后恢复
    if (currentSession.value && currentSession.value.videoId === videoId) {
      // 恢复播放：重置最后更新时间
      currentSession.value.lastUpdateTime = now
      // 启动定时器
      if (!sessionTimer) {
        sessionTimer = window.setInterval(updateSession, 1000)
      }
      return
    }

    // 停止之前的会话
    stopSession()

    // 检查这个视频在这次页面访问中是否已经计数过
    const hasCountedForThisVideo = lastCountedVideoId.value === videoId

    // 记录当前的总时长
    initialTotalTime = playRecords.value.get(videoId)?.totalPlayTime || 0
    pausedAccumulatedTime = 0

    currentSession.value = {
      videoId,
      startTime: now,
      lastUpdateTime: now,
      accumulatedTime: 0,
      hasCountedPlay: hasCountedForThisVideo,
    }

    // 只有在这次页面访问中还没计数过，才增加播放次数
    if (!hasCountedForThisVideo) {
      const existing = playRecords.value.get(videoId)
      if (existing) {
        existing.playCount++
        existing.lastPlayedAt = now
        saveToDB(existing)
      } else {
        const newRecord: VideoPlayRecord = {
          videoId,
          playCount: 1,
          totalPlayTime: 0,
          lastPlayedAt: now,
        }
        playRecords.value.set(videoId, newRecord)
        saveToDB(newRecord)
      }
      lastCountedVideoId.value = videoId
    }

    // 定时更新会话（每秒更新一次总时长）
    sessionTimer = window.setInterval(updateSession, 1000)
  }

  // 暂停会话
  function pauseSession() {
    if (sessionTimer) {
      clearInterval(sessionTimer)
      sessionTimer = null
    }

    if (currentSession.value) {
      // 保存当前累计的时长
      pausedAccumulatedTime = currentSession.value.accumulatedTime
      // 最后更新一次总时长
      const record = playRecords.value.get(currentSession.value.videoId)
      if (record) {
        record.totalPlayTime = initialTotalTime + Math.floor(currentSession.value.accumulatedTime)
        saveToDB(record)
      }
    }
  }

  // 更新会话（每秒调用）
  function updateSession() {
    if (!currentSession.value) return

    const now = Date.now()
    const delta = (now - currentSession.value.lastUpdateTime) / 1000
    currentSession.value.lastUpdateTime = now
    currentSession.value.accumulatedTime += delta

    // 只在内存中更新，不保存到 DB
    const record = playRecords.value.get(currentSession.value.videoId)
    if (record) {
      record.totalPlayTime = initialTotalTime + Math.floor(currentSession.value.accumulatedTime)
    }
  }

  // 停止会话
  function stopSession() {
    if (sessionTimer) {
      clearInterval(sessionTimer)
      sessionTimer = null
    }

    if (currentSession.value) {
      // 最后确保更新一次总时长
      const record = playRecords.value.get(currentSession.value.videoId)
      if (record) {
        record.totalPlayTime = initialTotalTime + Math.floor(currentSession.value.accumulatedTime)
        saveToDB(record)
      }
      currentSession.value = null
      pausedAccumulatedTime = 0
    }
  }

  // 格式化播放时长
  function formatPlayTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // 获取播放次数
  function getPlayCount(videoId: string): number {
    return playRecords.value.get(videoId)?.playCount || 0
  }

  // 获取总播放时长
  function getTotalPlayTime(videoId: string): number {
    return playRecords.value.get(videoId)?.totalPlayTime || 0
  }

  // 获取视频评分
  function getRating(videoId: string): number {
    return playRecords.value.get(videoId)?.rating || 0
  }

  // 设置视频评分
  function setRating(videoId: string, rating: number) {
    const existing = playRecords.value.get(videoId)
    if (existing) {
      existing.rating = rating
      saveToDB(existing)
    } else {
      const newRecord: VideoPlayRecord = {
        videoId,
        playCount: 0,
        totalPlayTime: 0,
        lastPlayedAt: Date.now(),
        rating,
      }
      playRecords.value.set(videoId, newRecord)
      saveToDB(newRecord)
    }
  }

  // 获取视频时长
  function getVideoDuration(videoId: string): number | undefined {
    return playRecords.value.get(videoId)?.videoDuration
  }

  // 保存视频时长
  function setVideoDuration(videoId: string, duration: number) {
    const existing = playRecords.value.get(videoId)
    if (existing) {
      // 只在没有保存过时才保存，或者时长有显著变化时更新
      if (!existing.videoDuration || Math.abs(existing.videoDuration - duration) > 1) {
        existing.videoDuration = duration
        saveToDB(existing)
      }
    } else {
      const newRecord: VideoPlayRecord = {
        videoId,
        playCount: 0,
        totalPlayTime: 0,
        lastPlayedAt: Date.now(),
        videoDuration: duration,
      }
      playRecords.value.set(videoId, newRecord)
      saveToDB(newRecord)
    }
  }

  // 获取质量标记
  function getIsBadQuality(videoId: string): boolean {
    return playRecords.value.get(videoId)?.isBadQuality || false
  }

  // 设置质量标记
  function setIsBadQuality(videoId: string, isBad: boolean) {
    const existing = playRecords.value.get(videoId)
    if (existing) {
      existing.isBadQuality = isBad
      saveToDB(existing)
    } else {
      const newRecord: VideoPlayRecord = {
        videoId,
        playCount: 0,
        totalPlayTime: 0,
        lastPlayedAt: Date.now(),
        isBadQuality: isBad,
      }
      playRecords.value.set(videoId, newRecord)
      saveToDB(newRecord)
    }
  }

  // 获取视频的精彩时间点
  function getTimestamps(videoId: string): VideoTimestamp[] {
    return playRecords.value.get(videoId)?.timestamps || []
  }

  // 添加精彩时间点
  function addTimestamp(videoId: string, time: number, label?: string, screenshot?: string) {
    const existing = playRecords.value.get(videoId)
    const timestamp: VideoTimestamp = {
      id: Date.now().toString(),
      time,
      label,
      screenshot,
      createdAt: Date.now(),
    }

    if (existing) {
      if (!existing.timestamps) {
        existing.timestamps = []
      }
      existing.timestamps.push(timestamp)
      existing.timestamps.sort((a, b) => a.time - b.time)
      saveToDB(existing)
    } else {
      const newRecord: VideoPlayRecord = {
        videoId,
        playCount: 0,
        totalPlayTime: 0,
        lastPlayedAt: Date.now(),
        timestamps: [timestamp],
      }
      playRecords.value.set(videoId, newRecord)
      saveToDB(newRecord)
    }
    return timestamp
  }

  // 删除精彩时间点
  function removeTimestamp(videoId: string, timestampId: string) {
    const existing = playRecords.value.get(videoId)
    if (existing && existing.timestamps) {
      existing.timestamps = existing.timestamps.filter(t => t.id !== timestampId)
      saveToDB(existing)
    }
  }

  // 格式化时间点显示
  function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // 获取所有有播放记录的视频，按最后播放时间排序
  function getAllRecords(): VideoPlayRecord[] {
    return Array.from(playRecords.value.values())
      .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
  }

  // 清除单个视频的播放记录
  async function clearRecord(videoId: string) {
    playRecords.value.delete(videoId)
    await indexedDB.deleteRecord(videoId)
  }

  // 清除所有播放记录
  async function clearAllRecords() {
    playRecords.value.clear()
    await indexedDB.clearAllRecords()
  }

  // 重置播放计数标记（进入新视频页面时调用）
  function resetPlayCountMarker() {
    lastCountedVideoId.value = null
  }

  return {
    playRecords,
    currentSession,
    isInitialized,
    initialize,
    getRecord,
    startSession,
    pauseSession,
    stopSession,
    getPlayCount,
    getTotalPlayTime,
    getRating,
    setRating,
    getTimestamps,
    addTimestamp,
    removeTimestamp,
    formatPlayTime,
    formatTimestamp,
    getAllRecords,
    clearRecord,
    clearAllRecords,
    resetPlayCountMarker,
    getVideoDuration,
    setVideoDuration,
    getIsBadQuality,
    setIsBadQuality,
  }
})
