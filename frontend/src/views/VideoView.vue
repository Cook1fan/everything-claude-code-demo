<template>
  <AppLayout>
    <div class="h-full flex flex-col bg-slate-900">
      <div v-if="!video" class="flex-1 flex items-center justify-center">
        <p class="text-slate-400">视频未找到</p>
      </div>

      <div v-else class="flex-1 flex overflow-hidden">
        <!-- 左主区 -->
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
          <!-- 顶部导航：返回 / 上下一个 -->
          <div class="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border-b border-slate-700 shrink-0">
            <button
              @click="goBack"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors text-sm"
            >
              ← 返回
            </button>
            <button
              v-if="prevVideo"
              @click="playVideo(prevVideo)"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors text-sm"
            >
              ← 上一个
            </button>
            <button
              v-if="nextVideo"
              @click="playVideo(nextVideo)"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors text-sm"
            >
              下一个 →
            </button>
          </div>

          <!-- 可滚动主内容 -->
          <div class="flex-1 overflow-y-auto">
            <!-- 标题区 -->
            <div class="bg-slate-800/40 border-b border-slate-700 px-6 py-3">
              <h1 class="text-base font-semibold text-white leading-snug break-words">
                {{ video.title }}
              </h1>
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                <span v-if="playCount > 0" class="text-slate-300">
                  ▶ <span class="font-medium text-white">{{ playCount }}</span> 次
                </span>
                <span v-if="totalPlayTime > 0" class="text-slate-300">
                  ⏱️ <span class="text-white">{{ playHistory.formatPlayTime(totalPlayTime) }}</span>
                </span>
                <span v-if="displayDuration" class="text-slate-300">
                  时长 <span class="text-white">{{ displayDuration }}</span>
                </span>
                <span class="truncate max-w-[60ch]" :title="video.directory">
                  📁 <span class="text-slate-300">{{ video.directory }}</span>
                </span>
                <span v-if="video.fileSize">
                  <span class="text-slate-500">大小</span>
                  <span class="ml-1 text-slate-300">{{ store.formatFileSize(video.fileSize) }}</span>
                </span>
                <span>
                  <span class="text-slate-500">格式</span>
                  <span class="ml-1 text-slate-300 uppercase">{{ video.videoExtension.slice(1) }}</span>
                </span>
              </div>
            </div>

            <!-- 播放器
                 大屏下用 max-h-[70vh] 限高，避免 16:9 跟着列宽无限放大撑出可视范围。
                 宽度按比例联动，配合 max-width 封顶，mx-auto 居中。 -->
            <div
              class="bg-black mx-auto aspect-video max-h-[70vh] w-full relative"
              style="max-width: min(100%, calc(70vh * 16 / 9));"
            >
              <video
                ref="videoRef"
                class="w-full h-full object-contain"
                playsinline
                @error="handleVideoError"
              />
            </div>

            <!-- 控制行1: 播放控制 + 倍速 -->
            <div class="bg-slate-800/60 px-4 py-3 border-b border-slate-700">
              <div class="flex items-center justify-center gap-2 flex-wrap">
                <button
                  @click="resetToStart"
                  class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-sm"
                  title="重置到开头"
                >
                  ⏮️ 重置
                </button>
                <button
                  @click="rewind10"
                  class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-sm"
                  title="后退10秒"
                >
                  ⏪ -10秒
                </button>
                <button
                  @click="togglePlay"
                  class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-base"
                >
                  {{ isPlaying ? '⏸️ 暂停' : '▶️ 播放' }}
                </button>
                <button
                  @click="forward15"
                  class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-sm"
                  title="前进15秒"
                >
                  ⏩ +15秒
                </button>
                <button
                  @click="forward30"
                  class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-sm"
                  title="前进30秒"
                >
                  ⏩ +30秒
                </button>

                <!-- 倍速组 -->
                <div class="flex items-center gap-1 ml-2 border-l border-slate-600 pl-2">
                  <button
                    v-for="rate in PLAYBACK_RATES"
                    :key="rate"
                    @click="setPlaybackRate(rate)"
                    :class="[
                      'px-2 py-1.5 rounded-md transition-colors font-medium text-sm',
                      playbackRate === rate
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    ]"
                  >
                    {{ rate }}x
                  </button>
                </div>
              </div>

              <!-- 错误提示 -->
              <div v-if="playError" class="mt-3 bg-red-900/30 border border-red-700 rounded-lg p-3">
                <h3 class="text-red-400 font-semibold mb-1 text-sm">⚠️ 网页播放失败</h3>
                <p class="text-red-300 text-sm">{{ playError }}</p>
                <p class="text-slate-400 text-sm mt-1">Chrome 只支持 MP4 (H.264) 和 WebM 格式，点击"本地播放"按钮！</p>
              </div>
            </div>

            <!-- 控制行2: 视频管理 / 评分质量 / 文件操作 -->
            <div class="bg-slate-800/30 px-4 py-3 border-b border-slate-700">
              <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
                <!-- 视频管理 -->
                <div class="flex items-center gap-2">
                  <button
                    @click="markTimestamp"
                    class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors font-medium text-sm"
                    title="标记精彩时间"
                  >
                    ⭐ 标记
                  </button>
                  <button
                    @click="generateSpriteSheet"
                    :disabled="spriteGenerating"
                    class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium text-sm"
                    title="生成雪碧图"
                  >
                    {{ spriteGenerating ? '⏳ 生成中...' : '🗂️ 雪碧图' }}
                  </button>
                  <button
                    @click="goToFrameExtract"
                    class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors font-medium text-sm"
                    title="提取帧"
                  >
                    📸 提取帧
                  </button>
                  <div class="relative">
                    <button
                      @click="gifPopoverOpen = !gifPopoverOpen"
                      :disabled="gifMaking"
                      class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium text-sm"
                      title="从当前帧向后制作 GIF"
                    >
                      {{ gifMaking ? '⏳ 制作中...' : '🎞️ 制作 GIF' }}
                    </button>
                    <div
                      v-if="gifPopoverOpen"
                      class="absolute z-20 mt-2 right-0 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3"
                      data-test="gif-popover"
                    >
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-sm text-slate-300">时长(秒)</span>
                        <span class="text-sm text-amber-300 font-mono">{{ gifDuration }}s</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="8"
                        step="1"
                        v-model.number="gifDuration"
                        class="w-full accent-amber-500"
                      />
                      <div class="flex justify-between text-xs text-slate-500 mt-1">
                        <span>3</span>
                        <span>8</span>
                      </div>

                      <div class="text-xs text-slate-400 mt-3 mb-1">尺寸</div>
                      <div class="flex gap-1 bg-slate-900/60 p-0.5 rounded-md">
                        <button
                          v-for="opt in GIF_SIZE_OPTIONS"
                          :key="opt.key"
                          type="button"
                          @click="gifSize = opt.key"
                          :class="[
                            'flex-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                            gifSize === opt.key
                              ? 'bg-amber-500 text-slate-900'
                              : 'text-slate-300 hover:text-white'
                          ]"
                        >
                          {{ opt.label }}<span class="opacity-70 ml-0.5">{{ opt.pixel }}</span>
                        </button>
                      </div>

                      <div class="flex items-center gap-2 mt-3">
                        <button
                          @click="confirmMakeGif"
                          :disabled="gifMaking"
                          class="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 text-white rounded-md text-sm font-medium"
                        >
                          {{ gifMaking ? '生成中...' : '开始制作' }}
                        </button>
                        <button
                          @click="gifPopoverOpen = false"
                          class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 评分 / 质量 -->
                <div class="flex items-center gap-3 border-l border-slate-600 pl-4">
                  <div class="flex items-center gap-2">
                    <span class="text-slate-400 text-sm">评分</span>
                    <StarRating v-model="rating" :showNumber="true" />
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="isBadQuality"
                      class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500 focus:ring-offset-slate-80"
                    />
                    <span class="text-slate-300 text-sm">🚫 无法生成雪碧图</span>
                  </label>
                </div>

                <!-- 文件操作 -->
                <div class="flex items-center gap-2 ml-auto">
                  <button
                    @click="openDirectory"
                    class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors text-sm"
                  >
                    📁 文件夹
                  </button>
                  <button
                    @click="openWithLocalPlayer"
                    class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors font-medium text-sm"
                  >
                    🎬 本地播放
                  </button>
                </div>
              </div>
            </div>

            <!-- 精彩时间点 -->
            <div v-if="timestamps.length > 0" class="border-b border-slate-700 p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-white font-semibold text-base">⭐ 精彩时间点</h3>
                <span class="text-slate-400 text-sm">{{ timestamps.length }} 个</span>
              </div>
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="ts in timestamps"
                  :key="ts.id"
                  class="group relative w-48 bg-slate-700 rounded-md overflow-hidden cursor-pointer hover:outline-2 hover:outline-purple-400 hover:outline-offset-2 hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-purple-500/30"
                  @click="jumpToTimestamp(ts.time)"
                  @contextmenu.prevent="deleteTimestamp(ts.id)"
                >
                  <div class="aspect-video bg-slate-600 relative">
                    <img
                      v-if="ts.screenshot"
                      :src="ts.screenshot"
                      class="w-full h-full object-cover"
                      alt="截图"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <span class="text-2xl">🎬</span>
                    </div>
                    <div class="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-white text-xs font-mono">
                      {{ playHistory.formatTimestamp(ts.time) }}
                    </div>
                    <button
                      @click.stop="deleteTimestamp(ts.id)"
                      class="absolute top-1 right-1 w-6 h-6 bg-red-600/80 hover:bg-red-600 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 text-white text-sm shadow-md hover:shadow-lg hover:scale-110"
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                  <div v-if="ts.label" class="p-2">
                    <p class="text-slate-300 text-xs truncate">{{ ts.label }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 雪碧图 -->
            <div v-if="video?.spritePath" class="p-4">
              <h3 class="text-white font-semibold text-sm mb-3">🗂️ 雪碧图</h3>
              <div class="flex gap-4 items-start">
                <div class="flex-1 bg-slate-700 rounded-md overflow-hidden">
                  <img
                    :src="store.getSpriteUrl(video)"
                    class="w-full h-auto"
                    alt="雪碧图"
                  />
                </div>
                <div class="w-64 shrink-0 space-y-2 text-sm text-slate-400">
                  <div v-if="spriteInfo" class="flex items-center gap-1.5">
                    <span>每 {{ spriteInfo.interval }} 秒一帧，共 {{ spriteInfo.duration }} 秒 ({{ spriteInfo.frameCount }} 帧)</span>
                  </div>
                  <div v-if="spriteGeneratedAt" class="flex flex-col gap-1">
                    <span>生成于: {{ new Date(spriteGeneratedAt).toLocaleString() }}</span>
                    <span v-if="spriteGenerateTime">
                      (耗时 {{ (spriteGenerateTime / 1000).toFixed(1) }} 秒)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- FFmpeg 提示 -->
            <div v-if="ffmpegAvailable === false && !spriteGenerating" class="p-4">
              <div class="p-3 bg-amber-900/30 border border-amber-700 rounded-md">
                <h3 class="text-amber-400 font-semibold text-sm mb-1">⚠️ FFmpeg 未配置</h3>
                <div class="text-amber-300 text-sm">下载 FFmpeg 并放到项目根目录</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧栏：同目录视频（宽度由组件内部控制：w-72 展开 / w-10 折叠） -->
        <div class="hidden md:block shrink-0 border-l border-slate-700">
          <RelatedVideoList :currentVideo="video" @select="handleSelectFromSidebar" />
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import type { Video, SpriteInfo } from '@/types'
import StarRating from '@/components/StarRating.vue'
import AppLayout from '@/components/AppLayout.vue'
import RelatedVideoList from '@/components/RelatedVideoList.vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

const store = useVideoStore()
const playHistory = usePlayHistoryStore()
const router = useRouter()
const route = useRoute()
const videoRef = ref<HTMLVideoElement | null>(null)
const playError = ref<string | null>(null)
const ffmpegAvailable = ref<boolean | null>(null)
const spriteGenerating = ref(false)

// GIF 制作
const gifPopoverOpen = ref(false)
const gifDuration = ref(3)
const gifMaking = ref(false)
const gifSize = ref<'small' | 'medium' | 'large'>('medium')
const GIF_SIZE_OPTIONS = [
  { key: 'small', label: '小', pixel: '320p' },
  { key: 'medium', label: '中', pixel: '480p' },
  { key: 'large', label: '大', pixel: '720p' },
] as const
const spriteInfo = ref<SpriteInfo | null>(null)
const spriteImage = ref<HTMLImageElement | null>(null)
const spriteLoaded = ref(false)
const playbackRate = ref(1)
let player: Plyr | null = null
let isPlaying = false
let savePositionTimer: number | null = null
let currentVttBlobUrl: string | null = null

// 保存 Plyr 事件监听器引用，用于清理
const playerEventListeners = new Map<string, (...args: any[]) => void>()

const PLAYBACK_RATES = [1, 1.5, 2, 3, 4] as const

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// 截图辅助函数
function captureScreenshot(videoElement: HTMLVideoElement, quality: number = 0.8, type: string = 'image/jpeg'): string | null {
  const canvas = document.createElement('canvas')
  const width = videoElement.videoWidth || 1280
  const height = videoElement.videoHeight || 720
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (ctx) {
    try {
      ctx.drawImage(videoElement, 0, 0, width, height)
      return canvas.toDataURL(type, quality)
    } catch (e) {
      console.error('截图失败:', e)
    }
  }
  return null
}

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
  } else if (videoRef.value) {
    videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime - 10)
  }
}

function forward15() {
  if (player) {
    player.forward(15)
  } else if (videoRef.value) {
    videoRef.value.currentTime = Math.min(videoRef.value.duration || 0, videoRef.value.currentTime + 15)
  }
}

function forward30() {
  if (player) {
    player.forward(30)
  } else if (videoRef.value) {
    videoRef.value.currentTime = Math.min(videoRef.value.duration || 0, videoRef.value.currentTime + 30)
  }
}

function togglePlay() {
  if (player && video.value) {
    player.togglePlay()
  } else if (videoRef.value) {
    if (videoRef.value.paused) {
      videoRef.value.play()
    } else {
      videoRef.value.pause()
    }
  }
}

type PlaybackRate = typeof PLAYBACK_RATES[number]

function setPlaybackRate(rate: PlaybackRate) {
  playbackRate.value = rate
  if (player) {
    player.speed = rate
  }
}

function resetToStart() {
  if (!video.value) return
  if (player) {
    player.stop()
  } else if (videoRef.value) {
    videoRef.value.currentTime = 0
    videoRef.value.pause()
  }
  playHistory.clearLastPlaybackPosition(video.value.id)
}

const video = computed(() => store.videos.find(v => v.id === route.params.id))

const playCount = computed(() => video.value ? playHistory.getPlayCount(video.value.id) : 0)
const totalPlayTime = computed(() => video.value ? playHistory.getTotalPlayTime(video.value.id) : 0)

const rating = computed(() => video.value ? playHistory.getRating(video.value.id) : 0)

const isBadQuality = computed({
  get: () => video.value ? playHistory.getIsBadQuality(video.value.id) : false,
  set: (value: boolean) => {
    if (video.value) {
      playHistory.setIsBadQuality(video.value.id, value)
    }
  },
})

const timestamps = computed(() => video.value ? playHistory.getTimestamps(video.value.id) : [])

// 视频时长：优先用 video.duration，缺失时回退到 playHistory 里的历史记录
const displayDuration = computed(() => {
  if (!video.value) return ''
  const d = video.value.duration ?? playHistory.getRecord(video.value.id)?.videoDuration
  return formatDuration(d)
})

const spriteGeneratedAt = computed(() =>
  video.value ? playHistory.getSpriteGeneratedAt(video.value.id) : undefined
)
const spriteGenerateTime = computed(() =>
  video.value ? playHistory.getSpriteGenerateTime(video.value.id) : undefined
)

function markTimestamp() {
  if (!player || !video.value) return
  const currentTime = player.currentTime

  const realVideoElement = player.elements.container?.querySelector('video') || videoRef.value
  if (!realVideoElement) return

  const screenshot = captureScreenshot(realVideoElement, 0.8, 'image/jpeg')
  playHistory.addTimestamp(video.value.id, currentTime, undefined, screenshot ?? undefined)
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

function goToFrameExtract() {
  if (video.value) {
    router.push({ name: 'frameExtract', query: { videoId: video.value.id, from: 'video' } })
  } else {
    router.push({ name: 'frameExtract' })
  }
}

function playVideo(v: Video) {
  playHistory.clearLastPlaybackPosition(v.id)
  store.addToRecent(v.id)
  router.push({ name: 'video', params: { id: v.id } })
}

// 侧栏点击：复用 playVideo
function handleSelectFromSidebar(v: Video) {
  playVideo(v)
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

function getVttUrl(vttPath: string): string {
  return `/api/image?path=${encodeURIComponent(vttPath)}`
}

function saveCurrentPosition() {
  if (!player || !video.value) return
  const currentTime = player.currentTime
  if (currentTime && currentTime > 0) {
    playHistory.setLastPlaybackPosition(video.value.id, currentTime)
  }
}

function cleanupVttBlobUrl() {
  if (currentVttBlobUrl) {
    URL.revokeObjectURL(currentVttBlobUrl)
    currentVttBlobUrl = null
  }
}

function cleanupSpriteImage() {
  if (spriteImage.value) {
    spriteImage.value.src = ''
    spriteImage.value.onload = null
    spriteImage.value.onerror = null
    spriteImage.value = null
  }
}

function cleanupPlayer() {
  if (player) {
    for (const [event, handler] of playerEventListeners) {
      try {
        // Plyr 的 off 期望具体的事件名字面量类型，这里用 unknown 绕过
        ;(player.off as unknown as (e: string, h: (...args: unknown[]) => void) => void)(
          event,
          handler as (...args: unknown[]) => void
        )
      } catch (e) {
        // 忽略移除监听器时的错误
      }
    }
    playerEventListeners.clear()

    try {
      player.destroy()
    } catch (e) {
      // 忽略销毁时的错误
    }
    player = null
  }
}

async function getVttBlobUrl(vttPath: string, spritePath: string): Promise<string | null> {
  cleanupVttBlobUrl()

  try {
    const response = await fetch(getVttUrl(vttPath))
    if (!response.ok) {
      console.error('VTT 文件加载失败:', response.status)
      return null
    }

    let vttContent = await response.text()
    const spriteFileName = spritePath.split(/[\\/]/).pop()

    if (spriteFileName) {
      const spriteUrl = store.getSpriteUrl({ spritePath } as unknown as Video)
      const searchStr = `${spriteFileName}#xywh=`
      const replaceStr = `${spriteUrl}#xywh=`
      vttContent = vttContent.split(searchStr).join(replaceStr)
    }

    const blob = new Blob([vttContent], { type: 'text/vtt' })
    currentVttBlobUrl = URL.createObjectURL(blob)
    return currentVttBlobUrl
  } catch (err) {
    console.error('处理 VTT 文件失败:', err)
    return null
  }
}

async function loadPlayer() {
  if (!videoRef.value || !video.value) return

  playError.value = null

  let vttBlobUrl: string | null = null
  if (video.value.spriteVttPath && video.value.spritePath) {
    vttBlobUrl = await getVttBlobUrl(video.value.spriteVttPath, video.value.spritePath)
  }

  const plyrConfig: Plyr.Options = {
    autoplay: false,
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
    seekTime: 10,
  }

  if (vttBlobUrl) {
    plyrConfig.previewThumbnails = {
      enabled: true,
      src: vttBlobUrl,
    }
  }

  if (player) {
    const sourceConfig: any = {
      type: 'video',
      sources: [
        {
          src: store.getVideoUrl(video.value),
          type: getMimeType(video.value.videoExtension),
        },
      ],
      poster: video.value.posterPath ? store.getImageUrl(video.value) : undefined,
    }
    if (vttBlobUrl) {
      sourceConfig.previewThumbnails = {
        enabled: true,
        src: vttBlobUrl,
      }
    }
    player.source = sourceConfig
    player.speed = playbackRate.value
  } else {
    if (videoRef.value) {
      videoRef.value.preload = 'metadata'
      videoRef.value.src = store.getVideoUrl(video.value)
      if (video.value.posterPath) {
        videoRef.value.poster = store.getImageUrl(video.value)
      }
    }

    player = new Plyr(videoRef.value, plyrConfig)

    const playHandler = () => {
      isPlaying = true
      if (video.value) {
        playHistory.startSession(video.value.id)
      }
      if (savePositionTimer) {
        clearInterval(savePositionTimer)
      }
      savePositionTimer = window.setInterval(saveCurrentPosition, 5000)
    }
    playerEventListeners.set('play', playHandler)
    player.on('play', playHandler)

    const pauseHandler = () => {
      isPlaying = false
      playHistory.pauseSession()
      saveCurrentPosition()
      if (savePositionTimer) {
        clearInterval(savePositionTimer)
        savePositionTimer = null
      }
    }
    playerEventListeners.set('pause', pauseHandler)
    player.on('pause', pauseHandler)

    const endedHandler = () => {
      isPlaying = false
      playHistory.pauseSession()
      saveCurrentPosition()
      if (savePositionTimer) {
        clearInterval(savePositionTimer)
        savePositionTimer = null
      }
    }
    playerEventListeners.set('ended', endedHandler)
    player.on('ended', endedHandler)

    const errorHandler = (..._args: unknown[]) => {
      console.error('Plyr 播放错误')
      playError.value = '视频播放失败，请检查视频格式'
    }
    playerEventListeners.set('error', errorHandler)
    player.on('error', errorHandler)

    const loadedmetadataHandler = () => {
      if (video.value && player) {
        const duration = player.duration
        if (duration && duration > 0) {
          playHistory.setVideoDuration(video.value.id, duration)
        }
        const lastPosition = playHistory.getLastPlaybackPosition(video.value.id)
        if (lastPosition && lastPosition > 0 && lastPosition < duration) {
          player.currentTime = lastPosition
        }
        player.speed = playbackRate.value
      }
    }
    playerEventListeners.set('loadedmetadata', loadedmetadataHandler)
    player.on('loadedmetadata', loadedmetadataHandler)

    const readyHandler = () => {
      if (video.value && player) {
        const duration = player.duration
        if (duration && duration > 0) {
          playHistory.setVideoDuration(video.value.id, duration)
        }
        const lastPosition = playHistory.getLastPlaybackPosition(video.value.id)
        if (lastPosition && lastPosition > 0) {
          player.currentTime = lastPosition
        }
        player.speed = playbackRate.value
      }
    }
    playerEventListeners.set('ready', readyHandler)
    player.on('ready', readyHandler)

    const ratechangeHandler = () => {
      if (player) {
        playbackRate.value = player.speed
      }
    }
    playerEventListeners.set('ratechange', ratechangeHandler)
    player.on('ratechange', ratechangeHandler)
  }
}

async function loadSprite() {
  if (!video.value?.spritePath) {
    spriteInfo.value = null
    spriteImage.value = null
    spriteLoaded.value = false
    return
  }

  const info = await store.getSpriteInfo(video.value.spritePath)
  spriteInfo.value = info

  if (info) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      spriteImage.value = img
      spriteLoaded.value = true
    }
    img.onerror = () => {
      spriteLoaded.value = false
    }
    img.src = store.getSpriteUrl(video.value)
  }
}

async function checkFFmpeg() {
  const status = await store.checkFFmpegStatus()
  ffmpegAvailable.value = status.available
  return status
}

async function generateSpriteSheet() {
  if (!video.value) return

  const ffmpegStatus = await checkFFmpeg()
  if (!ffmpegStatus.available) {
    alert('FFmpeg 未配置，请先按照提示下载并配置 FFmpeg')
    return
  }

  const hasSprite = !!video.value.spritePath
  let force = false

  if (hasSprite) {
    if (!confirm('该视频已生成过雪碧图，是否要重新生成？\n（重新生成会覆盖旧的雪碧图）')) {
      return
    }
    force = true
  } else {
    if (!confirm('生成雪碧图可能需要几分钟时间，确定要继续吗？')) {
      return
    }
  }

  spriteGenerating.value = true

  const result = await store.generateSprite(video.value.videoPath, force)
  if (!result.success) {
    console.error('雪碧图生成失败:', result.message || '生成失败')
    alert(result.message || '生成失败')
    spriteGenerating.value = false
    return
  }
}

function watchSpriteStatus() {
  if (!video.value) return

  let latestStatus = null
  for (const s of store.spriteStatusMap.values()) {
    if (s.videoPath === video.value.videoPath) {
      if (!latestStatus || (s.createdAt || 0) > (latestStatus.createdAt || 0)) {
        latestStatus = s
      }
    }
  }

  if (!latestStatus) {
    spriteGenerating.value = false
    return
  }

  if (latestStatus.status === 'completed' && !latestStatus.error) {
    spriteGenerating.value = false
  } else if (latestStatus.status === 'error' || latestStatus.error) {
    spriteGenerating.value = false
    alert('雪碧图生成失败: ' + (latestStatus.errorMessage || '未知错误'))
  } else if (latestStatus.status === 'aborted') {
    spriteGenerating.value = false
  } else if ((latestStatus.status === 'pending' || latestStatus.status === 'running') && !latestStatus.error) {
    spriteGenerating.value = true
  } else {
    spriteGenerating.value = false
  }
}

onMounted(async () => {
  await checkFFmpeg()
  playHistory.resetPlayCountMarker()
  window.addEventListener('keydown', handleKeyDown)
})

watch(video, async (newVideo, oldVideo) => {
  if (newVideo) {
    const spritePathChanged = newVideo.spritePath !== oldVideo?.spritePath
    if (spritePathChanged || !oldVideo) {
      await loadSprite()
    }

    if (!player || oldVideo?.id !== newVideo.id) {
      let attempts = 0
      const tryLoadPlayer = () => {
        if (videoRef.value && video.value) {
          loadPlayer()
        } else if (attempts < 10) {
          attempts++
          setTimeout(tryLoadPlayer, 50)
        }
      }
      tryLoadPlayer()
    }
  }
}, { immediate: true })

watch([
  () => store.spriteInProgress,
  () => store.spriteStatusMap
], () => {
  watchSpriteStatus()
}, { deep: true })

watch(() => route.params.id, async (_newId, oldId) => {
  if (oldId && player) {
    const currentTime = player.currentTime
    if (currentTime && currentTime > 0) {
      playHistory.setLastPlaybackPosition(oldId as unknown as string, currentTime)
    }
  }
  playHistory.stopSession()
  playHistory.resetPlayCountMarker()
  playbackRate.value = 1

  setTimeout(() => {
    loadPlayer()
  }, 50)
})

async function confirmMakeGif() {
  if (!video.value || !player) return
  gifMaking.value = true
  try {
    const startTime = player.currentTime ?? 0
    const { blob } = await store.makeGif({
      videoPath: video.value.videoPath,
      startTime,
      duration: gifDuration.value,
      size: gifSize.value,
    })

    // 浏览器下载
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeTitle = (video.value.title || 'clip').replace(/[\\/:*?"<>|]/g, '_')
    a.download = `${safeTitle}_${Math.floor(startTime)}s.gif`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    gifPopoverOpen.value = false
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    alert('GIF 制作失败: ' + msg)
  } finally {
    gifMaking.value = false
  }
}

onBeforeUnmount(() => {
  playHistory.stopSession()
  saveCurrentPosition()
  window.removeEventListener('keydown', handleKeyDown)
  if (savePositionTimer) {
    clearInterval(savePositionTimer)
    savePositionTimer = null
  }
  cleanupVttBlobUrl()
  cleanupSpriteImage()
  spriteGenerating.value = false
  cleanupPlayer()
})
</script>

<style scoped>
/* 让 Plyr 播放器正常显示在 aspect-video 容器中 */
:deep(.plyr) {
  height: 100% !important;
}

:deep(.plyr__video-wrapper) {
  height: 100% !important;
}

:deep(.plyr video) {
  height: 100% !important;
  width: 100% !important;
  object-fit: contain !important;
}

/* 隐藏滚动条但保持功能 */
::-webkit-scrollbar {
  height: 6px;
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
