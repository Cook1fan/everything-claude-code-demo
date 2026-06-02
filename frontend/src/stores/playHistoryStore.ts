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
        const updated: VideoPlayRecord = {
          ...existing,
          playCount: existing.playCount + 1,
          lastPlayedAt: now,
        }
        playRecords.value.set(videoId, updated)
        saveToDB(updated)
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
      // 最后更新一次总时长
      const record = playRecords.value.get(currentSession.value.videoId)
      if (record) {
        const updated = { ...record, totalPlayTime: initialTotalTime + Math.floor(currentSession.value.accumulatedTime) }
        playRecords.value.set(currentSession.value.videoId, updated)
        saveToDB(updated)
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
      const updated = { ...record, totalPlayTime: initialTotalTime + Math.floor(currentSession.value.accumulatedTime) }
      playRecords.value.set(currentSession.value.videoId, updated)
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
        const updated = { ...record, totalPlayTime: initialTotalTime + Math.floor(currentSession.value.accumulatedTime) }
        playRecords.value.set(currentSession.value.videoId, updated)
        saveToDB(updated)
      }
      currentSession.value = null
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
      const updated = { ...existing, rating }
      playRecords.value.set(videoId, updated)
      saveToDB(updated)
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
        const updated = { ...existing, videoDuration: duration }
        playRecords.value.set(videoId, updated)
        saveToDB(updated)
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

  // 获取最后播放位置
  function getLastPlaybackPosition(videoId: string): number {
    return playRecords.value.get(videoId)?.lastPlaybackPosition || 0
  }

  // 设置最后播放位置
  function setLastPlaybackPosition(videoId: string, position: number) {
    const existing = playRecords.value.get(videoId)
    if (existing) {
      const updated = { ...existing, lastPlaybackPosition: position }
      playRecords.value.set(videoId, updated)
      saveToDB(updated)
    } else {
      const newRecord: VideoPlayRecord = {
        videoId,
        playCount: 0,
        totalPlayTime: 0,
        lastPlayedAt: Date.now(),
        lastPlaybackPosition: position,
      }
      playRecords.value.set(videoId, newRecord)
      saveToDB(newRecord)
    }
  }

  // 清除最后播放位置
  function clearLastPlaybackPosition(videoId: string) {
    const existing = playRecords.value.get(videoId)
    if (existing) {
      const updated = { ...existing, lastPlaybackPosition: 0 }
      playRecords.value.set(videoId, updated)
      saveToDB(updated)
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
      const updated = { ...existing, isBadQuality: isBad }
      playRecords.value.set(videoId, updated)
      saveToDB(updated)
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

  // 获取雪碧图生成时间
  function getSpriteGeneratedAt(videoId: string): number | undefined {
    return playRecords.value.get(videoId)?.spriteGeneratedAt
  }

  // 获取雪碧图生成耗时
  function getSpriteGenerateTime(videoId: string): number | undefined {
    return playRecords.value.get(videoId)?.spriteGenerateTime
  }

  // 设置雪碧图生成记录
  function setSpriteGenerated(videoId: string, generateTime?: number) {
    const existing = playRecords.value.get(videoId)
    const now = Date.now()
    if (existing) {
      const updated = {
        ...existing,
        spriteGeneratedAt: now,
        spriteGenerateTime: generateTime,
      }
      playRecords.value.set(videoId, updated)
      saveToDB(updated)
    } else {
      const newRecord: VideoPlayRecord = {
        videoId,
        playCount: 0,
        totalPlayTime: 0,
        lastPlayedAt: now,
        spriteGeneratedAt: now,
        spriteGenerateTime: generateTime,
      }
      playRecords.value.set(videoId, newRecord)
      saveToDB(newRecord)
    }
  }

  // 获取视频的精彩时间点
  function getTimestamps(videoId: string): VideoTimestamp[] {
    return playRecords.value.get(videoId)?.timestamps || []
  }

  // 添加精彩时间点（评分根据标记数量自动计算，最多10星）
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
      const timestamps = [...(existing.timestamps || []), timestamp].sort((a, b) => a.time - b.time)
      const newCount = timestamps.length
      const rating = Math.min(newCount, 10) // 评分 = 标记数量，最多10星
      const updated = { ...existing, timestamps, rating }
      playRecords.value.set(videoId, updated)
      saveToDB(updated)
    } else {
      const newRecord: VideoPlayRecord = {
        videoId,
        playCount: 0,
        totalPlayTime: 0,
        lastPlayedAt: Date.now(),
        timestamps: [timestamp],
        rating: 1, // 第一个标记 = 1星
      }
      playRecords.value.set(videoId, newRecord)
      saveToDB(newRecord)
    }
    return timestamp
  }

  // 删除精彩时间点（评分随标记数量自动调整）
  function removeTimestamp(videoId: string, timestampId: string) {
    const existing = playRecords.value.get(videoId)
    if (existing && existing.timestamps) {
      const timestamps = existing.timestamps.filter(t => t.id !== timestampId)
      const newCount = timestamps.length
      const rating = Math.min(newCount, 10) // 评分 = 标记数量，最多10星
      const updated = { ...existing, timestamps, rating }
      playRecords.value.set(videoId, updated)
      saveToDB(updated)
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

  // 删除单个视频的播放记录 (同 clearRecord，别名)
  async function deleteRecord(videoId: string) {
    playRecords.value.delete(videoId)
    await indexedDB.deleteRecord(videoId)
  }

  // 清除单个视频的播放记录
  async function clearRecord(videoId: string) {
    await deleteRecord(videoId)
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
    deleteRecord,
    clearRecord,
    clearAllRecords,
    resetPlayCountMarker,
    getVideoDuration,
    setVideoDuration,
    getLastPlaybackPosition,
    setLastPlaybackPosition,
    clearLastPlaybackPosition,
    getIsBadQuality,
    setIsBadQuality,
    getSpriteGeneratedAt,
    getSpriteGenerateTime,
    setSpriteGenerated,
  }
})
