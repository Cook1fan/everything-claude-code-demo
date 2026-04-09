import type { VideoPlayRecord } from '@/types'

const DB_NAME = 'video-player-db'
const DB_VERSION = 2
const PLAY_HISTORY_STORE = 'playHistory'
const APP_STATE_STORE = 'appState'
const LEGACY_STORAGE_KEY = 'video-play-history'

export interface AppState {
  id: string
  recentVideos: string[]
  expandedNodes: string[]
  sortMode: string
  selectedDirectory: string
  searchQuery: string
  currentPage: number
  updatedAt: number
}

const DEFAULT_APP_STATE: AppState = {
  id: 'global',
  recentVideos: [],
  expandedNodes: [],
  sortMode: 'random',
  selectedDirectory: '',
  searchQuery: '',
  currentPage: 1,
  updatedAt: Date.now(),
}

let db: IDBDatabase | null = null
let dbReadyPromise: Promise<void> | null = null

/**
 * 打开或创建 IndexedDB 数据库
 */
export function openDB(): Promise<void> {
  if (dbReadyPromise) {
    return dbReadyPromise
  }

  dbReadyPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB 打开失败:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      console.log('IndexedDB 打开成功')
      resolve()
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion || 0

      if (oldVersion < 1) {
        // 版本 1: 添加播放历史存储
        if (!database.objectStoreNames.contains(PLAY_HISTORY_STORE)) {
          const store = database.createObjectStore(PLAY_HISTORY_STORE, { keyPath: 'videoId' })
          store.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false })
          console.log('IndexedDB 播放历史存储空间创建成功')
        }
      }

      if (oldVersion < 2) {
        // 版本 2: 添加应用状态存储
        if (!database.objectStoreNames.contains(APP_STATE_STORE)) {
          database.createObjectStore(APP_STATE_STORE, { keyPath: 'id' })
          console.log('IndexedDB 应用状态存储空间创建成功')
        }
      }
    }
  })

  return dbReadyPromise
}

/**
 * 确保数据库已打开
 */
async function ensureDB(): Promise<void> {
  if (!db) {
    await openDB()
  }
}

/**
 * 从 localStorage 迁移数据到 IndexedDB
 */
export async function migrateFromLocalStorage(): Promise<number> {
  await ensureDB()

  try {
    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacyData) {
      console.log('没有需要迁移的旧数据')
      return 0
    }

    const records = JSON.parse(legacyData) as Record<string, VideoPlayRecord>
    const recordArray = Object.values(records)

    if (recordArray.length === 0) {
      console.log('旧数据为空，无需迁移')
      return 0
    }

    // 写入 IndexedDB
    let migratedCount = 0

    for (const record of recordArray) {
      try {
        await putRecord(record)
        migratedCount++
      } catch (err) {
        console.error('迁移记录失败:', record.videoId, err)
      }
    }

    console.log(`数据迁移完成：${migratedCount}/${recordArray.length} 条记录`)

    // 保留 localStorage 数据作为备份，不删除
    // localStorage.removeItem(LEGACY_STORAGE_KEY)

    return migratedCount
  } catch (err) {
    console.error('数据迁移失败:', err)
    return 0
  }
}

/**
 * 获取事务存储对象
 */
function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  if (!db) {
    throw new Error('数据库未打开')
  }
  const transaction = db.transaction([storeName], mode)
  return transaction.objectStore(storeName)
}

/**
 * 包装 IndexedDB 请求为 Promise
 */
function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * 深度克隆对象，确保可以被 IndexedDB 存储
 */
function cloneForStorage<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// ===== 播放历史相关操作 =====

/**
 * 获取单条播放记录
 */
export async function getRecord(videoId: string): Promise<VideoPlayRecord | undefined> {
  await ensureDB()
  const store = getStore(PLAY_HISTORY_STORE, 'readonly')
  return wrapRequest(store.get(videoId))
}

/**
 * 写入或更新播放记录
 */
export async function putRecord(record: VideoPlayRecord): Promise<void> {
  await ensureDB()
  const store = getStore(PLAY_HISTORY_STORE, 'readwrite')
  const clonedRecord = cloneForStorage(record)
  await wrapRequest(store.put(clonedRecord))
}

/**
 * 删除单条播放记录
 */
export async function deleteRecord(videoId: string): Promise<void> {
  await ensureDB()
  const store = getStore(PLAY_HISTORY_STORE, 'readwrite')
  await wrapRequest(store.delete(videoId))
}

/**
 * 获取所有播放记录
 */
export async function getAllRecords(): Promise<VideoPlayRecord[]> {
  await ensureDB()
  const store = getStore(PLAY_HISTORY_STORE, 'readonly')
  return wrapRequest(store.getAll())
}

/**
 * 清除所有播放记录
 */
export async function clearAllRecords(): Promise<void> {
  await ensureDB()
  const store = getStore(PLAY_HISTORY_STORE, 'readwrite')
  await wrapRequest(store.clear())
}

// ===== 应用状态相关操作 =====

/**
 * 获取应用状态
 */
export async function getAppState(): Promise<AppState> {
  await ensureDB()
  const store = getStore(APP_STATE_STORE, 'readonly')
  const state = await wrapRequest(store.get('global'))
  return state || { ...DEFAULT_APP_STATE }
}

/**
 * 保存应用状态
 */
export async function putAppState(state: Partial<AppState>): Promise<void> {
  await ensureDB()
  const store = getStore(APP_STATE_STORE, 'readwrite')
  const currentState = await getAppState()
  const newState: AppState = {
    ...currentState,
    ...state,
    id: 'global',
    updatedAt: Date.now(),
  }
  const clonedState = cloneForStorage(newState)
  await wrapRequest(store.put(clonedState))
}

/**
 * 初始化数据库（包括迁移）
 */
export async function initDB(): Promise<void> {
  await openDB()
  await migrateFromLocalStorage()
}
