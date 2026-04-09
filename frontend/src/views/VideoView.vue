<template>
  <div class="min-h-screen bg-slate-900 flex flex-col">
    <!-- 顶部工具栏 -->
    <header class="bg-slate-800 border-b border-slate-700 px-4 py-3">
      <div class="flex items-center justify-between max-w-[1800px] mx-auto">
        <button
          @click="goBack"
          class="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
        >
          ← 返回
        </button>
        <h1 class="text-lg font-semibold text-white truncate max-w-3xl">
          {{ video?.title }}
        </h1>
        <div class="flex items-center gap-2">
          <button
            v-if="prevVideo"
            @click="playVideo(prevVideo)"
            class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            上一个
          </button>
          <button
            v-if="nextVideo"
            @click="playVideo(nextVideo)"
            class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            下一个
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 p-4">
      <div v-if="!video" class="text-center">
        <p class="text-slate-400">视频未找到</p>
      </div>

      <div v-else class="max-w-[1920px] mx-auto">
        <!-- 上半部分：播放器 + 信息 -->
        <div class="flex gap-4 mb-4">
          <!-- 左侧：播放器 -->
          <div class="flex-1">
            <!-- 播放器容器 -->
            <div class="bg-black rounded-xl overflow-hidden shadow-2xl">
              <video
                ref="videoRef"
                class="w-full"
                playsinline
                @error="handleVideoError"
              ></video>
            </div>

            <!-- 播放控制按钮 -->
            <div v-if="player" class="mt-3 flex items-center justify-center gap-3">
              <button
                @click="rewind10"
                class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                title="后退10秒"
              >
                ⏪ -10秒
              </button>
              <button
                @click="togglePlay"
                class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                {{ isPlaying ? '⏸️ 暂停' : '▶️ 播放' }}
              </button>
              <button
                @click="forward15"
                class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                title="前进15秒"
              >
                ⏩ +15秒
              </button>
              <button
                @click="forward30"
                class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                title="前进30秒"
              >
                ⏩ +30秒
              </button>
              <button
                @click="markTimestamp"
                class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                title="标记精彩时间"
              >
                ⭐ 标记
              </button>
              <button
                @click="takeScreenshot"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
                title="截取当前画面"
              >
                📷 截图
              </button>
            </div>

            <!-- 快速操作按钮 -->
            <div class="mt-3 flex gap-2">
              <button
                @click="openWithLocalPlayer"
                class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm"
              >
                🎬 用本地播放器打开
              </button>
              <button
                @click="openDirectory"
                class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
              >
                📁 打开文件位置
              </button>
            </div>

            <!-- 错误提示 -->
            <div v-if="playError" class="mt-3 bg-red-900/30 border border-red-700 rounded-xl p-3">
              <h3 class="text-red-400 font-semibold mb-1 text-sm">⚠️ 网页播放失败</h3>
              <p class="text-red-300 text-xs mb-2">{{ playError }}</p>
              <div class="text-slate-400 text-xs">
                <p>Chrome 只支持 MP4 (H.264) 和 WebM 格式。</p>
                <p>点击上方"用本地播放器打开"按钮来播放此视频！</p>
              </div>
            </div>
          </div>

          <!-- 右侧：视频信息 -->
          <div class="w-80 shrink-0">
            <div class="bg-slate-800 rounded-xl p-4">
              <h2 class="text-lg font-bold text-white mb-3 line-clamp-2">{{ video.title }}</h2>

              <!-- 评分 -->
              <div class="mb-4">
                <div class="flex items-center gap-3 mb-2">
                  <span class="text-slate-400 font-medium text-sm">评分</span>
                  <StarRating
                    v-model="rating"
                    :showNumber="true"
                  />
                </div>
              </div>

              <!-- 质量标记 -->
              <div class="mb-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="isBadQuality"
                    class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500 focus:ring-offset-slate-800"
                  />
                  <span class="text-slate-300 text-sm">
                    🚫 质量不好
                  </span>
                </label>
              </div>

              <!-- 播放统计 -->
              <div v-if="playCount > 0" class="mb-4 p-3 bg-slate-700/50 rounded-lg">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-400">
                    ▶️ 播放 <span class="text-white font-medium">{{ playCount }}</span> 次
                  </span>
                  <span v-if="totalPlayTime > 0" class="text-slate-400">
                    ⏱️ {{ playHistory.formatPlayTime(totalPlayTime) }}
                  </span>
                </div>
              </div>

              <!-- 视频信息 -->
              <div class="space-y-2 text-sm">
                <div class="flex items-start gap-2">
                  <span class="text-slate-500 w-14 shrink-0">目录:</span>
                  <span class="text-slate-300 break-all">{{ video.directory }}</span>
                </div>
                <div v-if="video.fileSize" class="flex items-center gap-2">
                  <span class="text-slate-500 w-14 shrink-0">大小:</span>
                  <span class="text-slate-300 font-medium">{{ store.formatFileSize(video.fileSize) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-slate-500 w-14 shrink-0">格式:</span>
                  <span class="text-slate-300 font-medium uppercase">{{ video.videoExtension.slice(1) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 下半部分：精彩时间点 -->
        <div v-if="timestamps.length > 0" class="bg-slate-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-white font-semibold">⭐ 精彩时间点</h3>
            <span class="text-slate-400 text-sm">{{ timestamps.length }} 个标记</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <div
              v-for="ts in timestamps"
              :key="ts.id"
              class="group relative bg-slate-700 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
              @click="jumpToTimestamp(ts.time)"
              @contextmenu.prevent="deleteTimestamp(ts.id)"
            >
              <!-- 截图 -->
              <div class="aspect-video bg-slate-600 relative">
                <img
                  v-if="ts.screenshot"
                  :src="ts.screenshot"
                  class="w-full h-full object-cover"
                  alt="截图"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <span class="text-4xl">🎬</span>
                </div>
                <!-- 时间叠加层 -->
                <div class="absolute bottom-1 right-1 bg-black/70 px-2 py-0.5 rounded text-white text-xs font-mono">
                  {{ playHistory.formatTimestamp(ts.time) }}
                </div>
                <!-- 删除按钮 -->
                <button
                  @click.stop="deleteTimestamp(ts.id)"
                  class="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs"
                  title="删除"
                >
                  ×
                </button>
              </div>
              <!-- 标签 -->
              <div v-if="ts.label" class="p-2">
                <p class="text-slate-300 text-xs truncate">{{ ts.label }}</p>
              </div>
            </div>
          </div>
          <p class="text-slate-500 text-xs mt-3">提示：点击卡片跳转，点击右上角 × 删除</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import type { Video } from '@/types'
import StarRating from '@/components/StarRating.vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

const store = useVideoStore()
const playHistory = usePlayHistoryStore()
const router = useRouter()
const route = useRoute()
const videoRef = ref<HTMLVideoElement | null>(null)
const playError = ref<string | null>(null)
let player: Plyr | null = null
let isPlaying = false

function handleKeyDown(event: KeyboardEvent) {
  if (!player) return

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      player.rewind(10)
      break
    case 'ArrowRight':
      event.preventDefault()
      player.forward(30)
      break
  }
}

function rewind10() {
  if (player) {
    player.rewind(10)
  }
}

function forward15() {
  if (player) {
    player.forward(15)
  }
}

function forward30() {
  if (player) {
    player.forward(30)
  }
}

function togglePlay() {
  if (player) {
    player.togglePlay()
  }
}

const video = computed(() => store.videos.find(v => v.id === route.params.id))

const playCount = computed(() => video.value ? playHistory.getPlayCount(video.value.id) : 0)
const totalPlayTime = computed(() => video.value ? playHistory.getTotalPlayTime(video.value.id) : 0)

const rating = computed({
  get: () => video.value ? playHistory.getRating(video.value.id) : 0,
  set: (value: number) => {
    if (video.value) {
      playHistory.setRating(video.value.id, value)
    }
  },
})

const isBadQuality = computed({
  get: () => video.value ? playHistory.getIsBadQuality(video.value.id) : false,
  set: (value: boolean) => {
    if (video.value) {
      playHistory.setIsBadQuality(video.value.id, value)
    }
  },
})

const timestamps = computed(() => video.value ? playHistory.getTimestamps(video.value.id) : [])

function markTimestamp() {
  if (!player || !video.value) return
  const currentTime = player.currentTime

  // 从 Plyr 实例获取真实的视频元素
  const realVideoElement = player.elements.container?.querySelector('video') || videoRef.value
  if (!realVideoElement) return

  // 截取当前画面
  const canvas = document.createElement('canvas')
  const width = realVideoElement.videoWidth || 1280
  const height = realVideoElement.videoHeight || 720
  canvas.width = width
  canvas.height = height

  let screenshot: string | undefined
  const ctx = canvas.getContext('2d')
  if (ctx) {
    try {
      ctx.drawImage(realVideoElement, 0, 0, width, height)
      screenshot = canvas.toDataURL('image/jpeg', 0.8)
    } catch (e) {
      console.error('截图失败:', e)
    }
  }

  playHistory.addTimestamp(video.value.id, currentTime, undefined, screenshot)
}

function takeScreenshot() {
  if (!player || !video.value) return

  // 从 Plyr 实例获取真实的视频元素
  const realVideoElement = player.elements.container?.querySelector('video') || videoRef.value
  if (!realVideoElement) return

  const canvas = document.createElement('canvas')
  const width = realVideoElement.videoWidth || 1280
  const height = realVideoElement.videoHeight || 720
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (ctx) {
    try {
      ctx.drawImage(realVideoElement, 0, 0, width, height)

      // 下载截图
      const link = document.createElement('a')
      link.download = `${video.value.title}_screenshot_${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error('截图失败:', e)
      alert('截图失败，请重试')
    }
  }
}

function jumpToTimestamp(time: number) {
  if (player) {
    player.currentTime = time
    if (!isPlaying) {
      player.play()
    }
  }
}

function deleteTimestamp(timestampId: string) {
  if (!video.value) return
  if (confirm('确定要删除这个时间点吗？')) {
    playHistory.removeTimestamp(video.value.id, timestampId)
  }
}

const videoIndex = computed(() => store.filteredVideos.findIndex(v => v.id === route.params.id))

const prevVideo = computed(() => {
  const idx = videoIndex.value
  if (idx > 0) return store.filteredVideos[idx - 1]
  return null
})

const nextVideo = computed(() => {
  const idx = videoIndex.value
  if (idx < store.filteredVideos.length - 1) return store.filteredVideos[idx + 1]
  return null
})

function goBack() {
  router.push({ name: 'home' })
}

function playVideo(v: Video) {
  store.addToRecent(v.id)
  router.push({ name: 'video', params: { id: v.id } })
}

function handleVideoError(event: Event) {
  const target = event.target as HTMLVideoElement
  console.error('视频播放错误:', target.error)
  playError.value = `无法播放此视频 (${target.error?.code || '未知错误'})`
}

async function openWithLocalPlayer() {
  if (!video.value) return
  try {
    await fetch('/api/open-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: video.value.videoPath }),
    })
  } catch (err) {
    console.error('打开本地播放器失败:', err)
    alert('请手动打开文件：\n' + video.value.videoPath)
  }
}

async function openDirectory() {
  if (!video.value) return
  try {
    await fetch('/api/open-directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: video.value.directory }),
    })
  } catch (err) {
    console.error('打开目录失败:', err)
    alert('请手动打开目录：\n' + video.value.directory)
  }
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.m4v': 'video/x-m4v',
    '.mov': 'video/quicktime',
  }
  return mimeTypes[ext.toLowerCase()] || 'video/mp4'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function loadPlayer() {
  if (!videoRef.value || !video.value) return

  playError.value = null

  if (player) {
    player.source = {
      type: 'video',
      sources: [
        {
          src: store.getVideoUrl(video.value),
          type: getMimeType(video.value.videoExtension),
        },
      ],
      poster: video.value.posterPath ? store.getImageUrl(video.value) : undefined,
    }
  } else {
    if (videoRef.value) {
      videoRef.value.preload = 'metadata'
      videoRef.value.src = store.getVideoUrl(video.value)
      if (video.value.posterPath) {
        videoRef.value.poster = store.getImageUrl(video.value)
      }
    }

    player = new Plyr(videoRef.value, {
      autoplay: false,
      preload: 'metadata',
      controls: [
        'play-large',
        'play',
        'progress',
        'current-time',
        'mute',
        'volume',
        'captions',
        'settings',
        'pip',
        'airplay',
        'fullscreen',
      ],
      keyboard: { focused: true, global: true },
      ratio: '16:9',
      seekTime: 10,
    })

    player.on('play', () => {
      isPlaying = true
      if (video.value) {
        playHistory.startSession(video.value.id)
      }
    })

    player.on('pause', () => {
      isPlaying = false
      playHistory.pauseSession()
    })

    player.on('ended', () => {
      isPlaying = false
      playHistory.pauseSession()
    })

    player.on('error', (event) => {
      console.error('Plyr 播放错误:', event)
      playError.value = '视频播放失败，请检查视频格式'
    })

    // 监听视频元数据加载完成，保存视频时长
    player.on('loadedmetadata', () => {
      if (video.value && player) {
        const duration = player.duration
        if (duration && duration > 0) {
          playHistory.setVideoDuration(video.value.id, duration)
        }
      }
    })

    // 监听播放器 ready 事件，也尝试获取时长
    player.on('ready', () => {
      if (video.value && player) {
        const duration = player.duration
        if (duration && duration > 0) {
          playHistory.setVideoDuration(video.value.id, duration)
        }
      }
    })
  }
}

onMounted(async () => {
  if (store.videos.length === 0) {
    await store.loadVideos()
  }

  playHistory.resetPlayCountMarker()
  window.addEventListener('keydown', handleKeyDown)

  setTimeout(() => {
    loadPlayer()
  }, 100)
})

watch(() => route.params.id, (newId, oldId) => {
  playHistory.stopSession()
  playHistory.resetPlayCountMarker()
  setTimeout(() => {
    loadPlayer()
  }, 50)
})

onBeforeUnmount(() => {
  playHistory.stopSession()
  window.removeEventListener('keydown', handleKeyDown)
  if (player) {
    player.destroy()
    player = null
  }
})
</script>
