<template>
  <AppLayout>
    <div class="flex flex-col h-full">
      <main class="flex-1 overflow-y-auto p-6">
        <div>
          <!-- 页面标题和控制栏 -->
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-4">
              <button
                @click="goBack"
                class="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                ← 返回
              </button>
              <h1 class="text-2xl font-bold text-white">
                📊 播放历史
              </h1>
            </div>
            <div class="flex items-center gap-4">
              <!-- 排序选择 -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 text-sm">排序:</span>
                <select
                  :value="sortMode"
                  @change="(e) => sortMode = e.target.value as any"
                  class="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="duration">播放时长</option>
                  <option value="count">播放次数</option>
                  <option value="recent">最近播放</option>
                </select>
              </div>
              <button
                v-if="records.length > 0"
                @click="confirmClearAll"
                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                清除全部
              </button>
            </div>
          </div>

          <div v-if="records.length === 0" class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <div class="text-6xl mb-4">📺</div>
              <h2 class="text-xl font-semibold text-white mb-2">暂无播放记录</h2>
              <p class="text-slate-400">开始观看视频后，播放记录会显示在这里</p>
              <button
                @click="goBack"
                class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                去浏览视频
              </button>
            </div>
          </div>

          <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div
              v-for="record in sortedRecords"
              :key="record.videoId"
              class="relative"
            >
              <VideoCard
                v-if="getVideo(record.videoId)"
                :video="getVideo(record.videoId)!"
                @click="playVideo(getVideo(record.videoId)!)"
              />

              <!-- 视频已删除提示 -->
              <div
                v-else
                class="bg-slate-800 rounded-xl overflow-hidden"
              >
                <div class="aspect-video bg-slate-700 flex items-center justify-center">
                  <div class="text-center">
                    <div class="text-4xl mb-2">❓</div>
                    <div class="text-slate-500 text-xs">视频已删除</div>
                  </div>
                </div>
                <div class="p-4">
                  <h3 class="font-semibold text-slate-500 truncate">
                    视频已删除
                  </h3>
                </div>
              </div>

              <!-- 播放历史信息 -->
              <div v-if="getVideo(record.videoId)" class="mt-2 px-1">
                <div class="flex items-center justify-between text-xs text-slate-400">
                  <span class="text-green-400">
                    ⏱️ {{ playHistory.formatPlayTime(record.totalPlayTime) }}
                  </span>
                  <span>
                    ▶️ {{ record.playCount }}次
                  </span>
                </div>
                <div class="mt-1 text-xs text-slate-500 truncate">
                  {{ formatDate(record.lastPlayedAt) }}
                </div>
              </div>

              <!-- 删除按钮 -->
              <button
                @click.stop="confirmClear(record.videoId)"
                class="absolute top-2 right-2 z-10 w-8 h-8 bg-black/50 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除此记录"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import VideoCard from '@/components/VideoCard.vue'
import AppLayout from '@/components/AppLayout.vue'
import type { Video, VideoPlayRecord } from '@/types'

const store = useVideoStore()
const playHistory = usePlayHistoryStore()
const router = useRouter()

type SortMode = 'duration' | 'count' | 'recent'
const sortMode = ref<SortMode>('duration')

const records = computed(() => playHistory.getAllRecords())

const sortedRecords = computed(() => {
  const result = [...records.value]
  switch (sortMode.value) {
    case 'duration':
      result.sort((a, b) => b.totalPlayTime - a.totalPlayTime)
      break
    case 'count':
      result.sort((a, b) => b.playCount - a.playCount)
      break
    case 'recent':
      result.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
      break
  }
  return result
})

function getVideo(videoId: string): Video | undefined {
  return store.videos.find(v => v.id === videoId)
}

function playVideo(video: Video) {
  store.addToRecent(video.id)
  router.push({ name: 'video', params: { id: video.id } })
}

function goBack() {
  router.push({ name: 'home' })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 1天内
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    if (hours < 1) {
      const minutes = Math.floor(diff / (60 * 1000))
      return minutes < 1 ? '刚刚' : `${minutes}分钟前`
    }
    return `${hours}小时前`
  }

  // 7天内
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days}天前`
  }

  // 更早的显示日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function confirmClear(videoId: string) {
  if (confirm('确定要删除这条播放记录吗？')) {
    playHistory.clearRecord(videoId)
  }
}

function confirmClearAll() {
  if (confirm('确定要清除所有播放记录吗？此操作不可恢复！')) {
    playHistory.clearAllRecords()
  }
}
</script>
