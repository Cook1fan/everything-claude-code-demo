<template>
  <AppLayout>
    <div class="h-full flex flex-col bg-slate-900">
      <div v-if="!video" class="flex-1 flex items-center justify-center">
        <p class="text-slate-400">视频未找到</p>
      </div>

      <div v-else class="flex-1 flex flex-col overflow-hidden">
        <!-- 顶部导航栏 -->
        <div class="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border-b border-slate-700 shrink-0">
          <button
            @click="goBack"
            class="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            ← 返回
          </button>
          <h1 class="text-lg font-bold text-white truncate flex-1">
            {{ video.title }}
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

        <!-- 视频播放器区域 - 最大化利用空间 -->
        <div class="flex-1 flex overflow-hidden">
          <!-- 左侧：播放器（占大部分空间） -->
          <div class="flex-[4] flex flex-col bg-black min-w-0">
            <!-- 播放器容器 - 最大化 -->
            <div class="flex-1 relative bg-black min-h-0">
              <video
                ref="videoRef"
                class="w-full h-full object-contain"
                playsinline
                @error="handleVideoError"
              />
            </div>

            <!-- 播放控制按钮 -->
            <div v-if="player" class="bg-slate-800 px-3 py-2 border-t border-slate-700 shrink-0">
              <div class="flex items-center justify-center gap-1.5 flex-wrap">
                <button
                  @click="resetToStart"
                  class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-xs"
                  title="重置到开头"
                >
                  ⏮️ 重置
                </button>
                <button
                  @click="rewind10"
                  class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-xs"
                  title="后退10秒"
                >
                  ⏪ -10秒
                </button>
                <button
                  @click="togglePlay"
                  class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-sm"
                >
                  {{ isPlaying ? '⏸️ 暂停' : '▶️ 播放' }}
                </button>
                <button
                  @click="forward15"
                  class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-xs"
                  title="前进15秒"
                >
                  ⏩ +15秒
                </button>
                <button
                  @click="forward30"
                  class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors font-medium text-xs"
                  title="前进30秒"
                >
                  ⏩ +30秒
                </button>

                <!-- 播放速度按钮 -->
                <div class="flex items-center gap-0.5 ml-1 border-l border-slate-600 pl-1.5">
                  <button
                    @click="setPlaybackRate(1)"
                    :class="[
                      'px-2 py-1.5 rounded-md transition-colors font-medium text-xs',
                      playbackRate === 1 ? 'bg-teal-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    ]"
                  >
                    1x
                  </button>
                  <button
                    @click="setPlaybackRate(1.5)"
                    :class="[
                      'px-2 py-1.5 rounded-md transition-colors font-medium text-xs',
                      playbackRate === 1.5 ? 'bg-teal-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    ]"
                  >
                    1.5x
                  </button>
                  <button
                    @click="setPlaybackRate(2)"
                    :class="[
                      'px-2 py-1.5 rounded-md transition-colors font-medium text-xs',
                      playbackRate === 2 ? 'bg-teal-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    ]"
                  >
                    2x
                  </button>
                  <button
                    @click="setPlaybackRate(3)"
                    :class="[
                      'px-2 py-1.5 rounded-md transition-colors font-medium text-xs',
                      playbackRate === 3 ? 'bg-teal-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    ]"
                  >
                    3x
                  </button>
                  <button
                    @click="setPlaybackRate(4)"
                    :class="[
                      'px-2 py-1.5 rounded-md transition-colors font-medium text-xs',
                      playbackRate === 4 ? 'bg-teal-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    ]"
                  >
                    4x
                  </button>
                </div>

                <button
                  @click="markTimestamp"
                  class="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors font-medium text-xs"
                  title="标记精彩时间"
                >
                  ⭐ 标记
                </button>
                <button
                  @click="takeScreenshot"
                  class="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors font-medium text-xs"
                  title="截取当前画面"
                >
                  📷 截图
                </button>
                <button
                  @click="generateSpriteSheet"
                  :disabled="spriteGenerating"
                  class="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium text-xs"
                  title="生成雪碧图"
                >
                  {{ spriteGenerating ? '⏳ 生成中...' : '🗂️ 雪碧图' }}
                </button>
              </div>

              <!-- 错误提示 -->
              <div v-if="playError" class="mt-2 bg-red-900/30 border border-red-700 rounded-lg p-2">
                <h3 class="text-red-400 font-semibold mb-0.5 text-xs">⚠️ 网页播放失败</h3>
                <p class="text-red-300 text-xs">{{ playError }}</p>
                <p class="text-slate-400 text-xs mt-1">Chrome 只支持 MP4 (H.264) 和 WebM 格式，点击"本地播放"按钮！</p>
              </div>
            </div>
          </div>

          <!-- 右侧：视频信息（较窄，只占小部分空间） -->
          <div class="w-64 shrink-0 bg-slate-800 border-l border-slate-700 overflow-y-auto">
            <div class="p-3">
              <!-- 评分 -->
              <div class="mb-3">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-slate-400 font-medium text-xs">评分</span>
                  <StarRating
                    v-model="rating"
                    :showNumber="true"
                  />
                </div>
              </div>

              <!-- 质量标记 -->
              <div class="mb-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="isBadQuality"
                    class="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500 focus:ring-offset-slate-80"
                  />
                  <span class="text-slate-300 text-xs">
                    🚫 质量不好
                  </span>
                </label>
              </div>

              <!-- 播放统计 -->
              <div v-if="playCount > 0" class="mb-3 p-2 bg-slate-700/50 rounded-md">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-400">
                    ▶️ 播放 <span class="text-white font-medium">{{ playCount }}</span> 次
                  </span>
                  <span v-if="totalPlayTime > 0" class="text-slate-400">
                    ⏱️ {{ playHistory.formatPlayTime(totalPlayTime) }}
                  </span>
                </div>
              </div>

              <!-- 快速操作按钮 -->
              <div class="mb-3 flex gap-1.5">
                <button
                  @click="openDirectory"
                  class="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors text-xs"
                >
                  📁 文件夹
                </button>
                <button
                  @click="openWithLocalPlayer"
                  class="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors font-medium text-xs"
                >
                  🎬 本地播放
                </button>
              </div>

              <!-- 视频信息 -->
              <div class="space-y-1.5 text-xs">
                <div class="flex items-start gap-1.5">
                  <span class="text-slate-500 w-10 shrink-0">目录:</span>
                  <span class="text-slate-300 break-all">{{ video.directory }}</span>
                </div>
                <div v-if="video.fileSize" class="flex items-center gap-1.5">
                  <span class="text-slate-500 w-10 shrink-0">大小:</span>
                  <span class="text-slate-300 font-medium">{{ store.formatFileSize(video.fileSize) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-slate-500 w-10 shrink-0">格式:</span>
                  <span class="text-slate-300 font-medium uppercase">{{ video.videoExtension.slice(1) }}</span>
                </div>
              </div>

              <!-- FFmpeg 提示 -->
              <div v-if="ffmpegAvailable === false && !spriteGenerating" class="mt-3 p-2 bg-amber-900/30 border border-amber-700 rounded-md">
                <h3 class="text-amber-400 font-semibold text-xs mb-1">⚠️ FFmpeg 未配置</h3>
                <div class="text-amber-300 text-xs space-y-0.5">
                  <p>下载 FFmpeg 并放到项目根目录</p>
                </div>
              </div>
            </div>

            <!-- 精彩时间点 -->
            <div v-if="timestamps.length > 0" class="border-t border-slate-700 p-3">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-white font-semibold text-sm">⭐ 精彩时间点</h3>
                <span class="text-slate-400 text-xs">{{ timestamps.length }} 个</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="ts in timestamps"
                  :key="ts.id"
                  class="group relative bg-slate-700 rounded-md overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
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
                      <span class="text-lg">🎬</span>
                    </div>
                    <!-- 时间叠加层 -->
                    <div class="absolute bottom-0.5 right-0.5 bg-black/70 px-1 py-0.5 rounded text-white text-[10px] font-mono">
                      {{ playHistory.formatTimestamp(ts.time) }}
                    </div>
                    <!-- 删除按钮 -->
                    <button
                      @click.stop="deleteTimestamp(ts.id)"
                      class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px]"
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                  <!-- 标签 -->
                  <div v-if="ts.label" class="p-1">
                    <p class="text-slate-300 text-[10px] truncate">{{ ts.label }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 雪碧图预览 -->
            <div v-if="video?.spritePath" class="border-t border-slate-700 p-3">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-white font-semibold text-sm">🗂️ 雪碧图预览</h3>
                <span v-if="spriteInfo" class="text-slate-400 text-xs">{{ spriteInfo.frameCount }} 帧</span>
              </div>
              <div class="bg-slate-700 rounded-md overflow-hidden">
                <img
                  :src="store.getSpriteUrl(video)"
                  class="w-full h-auto"
                  alt="雪碧图"
                />
              </div>
              <div class="mt-1.5 space-y-0.5">
                <p v-if="spriteInfo" class="text-slate-500 text-xs">
                  每 {{ spriteInfo.interval }} 秒一帧，共 {{ spriteInfo.duration }} 秒
                </p>
                <p v-if="spriteGeneratedAt" class="text-slate-500 text-xs">
                  生成于 {{ new Date(spriteGeneratedAt).toLocaleString() }}
                  <span v-if="spriteGenerateTime">
                    (耗时 {{ (spriteGenerateTime / 1000).toFixed(1) }} 秒)
                  </span>
                </p>
              </div>
            </div>
          </div>
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
const spriteGenStartTime = ref<number | null>(null)
const spriteInfo = ref<SpriteInfo | null>(null)
const spriteImage = ref<HTMLImageElement | null>(null)
const spriteLoaded = ref(false)
const playbackRate = ref(1)
let player: Plyr | null = null
let isPlaying = false
let savePositionTimer: number | null = null
let currentVttBlobUrl: string | null = null

// 检查当前视频是否正在生成雪碧图
const isCurrentVideoGenerating = computed(() => {
  if (!video.value) return false
  const status = store.spriteStatusMap.get(video.value.videoPath)
  if (!status) return false
  return status.percent != null && status.percent < 100 && !status.error
})

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
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

function setPlaybackRate(rate: number) {
  playbackRate.value = rate
  if (player) {
    player.speed = rate
  }
}

function resetToStart() {
  if (!player || !video.value) return
  // 先重置到开始
  player.stop()
  // 删除当前播放位置记录
  playHistory.clearLastPlaybackPosition(video.value.id)
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

// 雪碧图生成时间相关
const spriteGeneratedAt = computed(() =>
  video.value ? playHistory.getSpriteGeneratedAt(video.value.id) : undefined
)
const spriteGenerateTime = computed(() =>
  video.value ? playHistory.getSpriteGenerateTime(video.value.id) : undefined
)

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
  playHistory.clearLastPlaybackPosition(v.id)  // 清除之前的播放位置，从头开始
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

function getVttUrl(vttPath: string): string {
  return `/api/image?path=${encodeURIComponent(vttPath)}`
}

// 保存当前播放位置
function saveCurrentPosition() {
  if (!player || !video.value) return
  const currentTime = player.currentTime
  if (currentTime && currentTime > 0) {
    playHistory.setLastPlaybackPosition(video.value.id, currentTime)
  }
}

// 清理之前的 VTT Blob URL
function cleanupVttBlobUrl() {
  if (currentVttBlobUrl) {
    URL.revokeObjectURL(currentVttBlobUrl)
    currentVttBlobUrl = null
  }
}

// 动态加载并修改 VTT 文件，使雪碧图路径正确
async function getVttBlobUrl(vttPath: string, spritePath: string): Promise<string | null> {
  // 先清理旧的
  cleanupVttBlobUrl()

  try {
    // 加载 VTT 文件内容
    const response = await fetch(getVttUrl(vttPath))
    if (!response.ok) {
      console.error('VTT 文件加载失败:', response.status)
      return null
    }

    let vttContent = await response.text()
    const spriteFileName = spritePath.split(/[\\/]/).pop()

    console.log('原始 VTT 内容:', vttContent.substring(0, 300) + '...')
    console.log('雪碧图文件名:', spriteFileName)

    // 替换 VTT 中的雪碧图文件名为完整的 API URL
    if (spriteFileName) {
      const spriteUrl = store.getSpriteUrl({ spritePath } as unknown as Video)
      console.log('雪碧图 URL:', spriteUrl)
      // 替换所有 "filename#xywh=" 为 "完整URL#xywh="
      // 使用字符串替换而不是正则表达式，避免特殊字符问题
      const searchStr = `${spriteFileName}#xywh=`
      const replaceStr = `${spriteUrl}#xywh=`
      vttContent = vttContent.split(searchStr).join(replaceStr)
    }

    console.log('修改后的 VTT 内容:', vttContent.substring(0, 300) + '...')

    // 创建 Blob URL
    const blob = new Blob([vttContent], { type: 'text/vtt' })
    currentVttBlobUrl = URL.createObjectURL(blob)
    console.log('创建的 VTT Blob URL:', currentVttBlobUrl)
    return currentVttBlobUrl
  } catch (err) {
    console.error('处理 VTT 文件失败:', err)
    return null
  }
}

async function loadPlayer() {
  if (!videoRef.value || !video.value) return

  playError.value = null

  // 如果有 VTT，先处理它
  let vttBlobUrl: string | null = null
  if (video.value.spriteVttPath && video.value.spritePath) {
    vttBlobUrl = await getVttBlobUrl(video.value.spriteVttPath, video.value.spritePath)
    console.log('VTT Blob URL:', vttBlobUrl)
  }

  // 构建 Plyr 配置
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

  // 只有在有 VTT 时才添加预览缩略图配置
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
    // 恢复播放速度
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

    player.on('play', () => {
      isPlaying = true
      if (video.value) {
        playHistory.startSession(video.value.id)
      }
      // 开始定期保存播放位置（每5秒）
      if (savePositionTimer) {
        clearInterval(savePositionTimer)
      }
      savePositionTimer = window.setInterval(saveCurrentPosition, 5000)
    })

    player.on('pause', () => {
      isPlaying = false
      playHistory.pauseSession()
      // 暂停时立即保存播放位置
      saveCurrentPosition()
      if (savePositionTimer) {
        clearInterval(savePositionTimer)
        savePositionTimer = null
      }
    })

    player.on('ended', () => {
      isPlaying = false
      playHistory.pauseSession()
      // 播放结束时保存位置
      saveCurrentPosition()
      if (savePositionTimer) {
        clearInterval(savePositionTimer)
        savePositionTimer = null
      }
    })

    player.on('error', (event) => {
      console.error('Plyr 播放错误:', event)
      playError.value = '视频播放失败，请检查视频格式'
    })

    // 监听视频元数据加载完成，保存视频时长并恢复播放位置
    player.on('loadedmetadata', () => {
      if (video.value && player) {
        const duration = player.duration
        if (duration && duration > 0) {
          playHistory.setVideoDuration(video.value.id, duration)
        }
        // 恢复上次播放位置（如果存在）
        const lastPosition = playHistory.getLastPlaybackPosition(video.value.id)
        if (lastPosition && lastPosition > 0 && lastPosition < duration) {
          player.currentTime = lastPosition
        }
        // 恢复播放速度
        player.speed = playbackRate.value
      }
    })

    // 监听播放器 ready 事件，也尝试获取时长和恢复播放位置
    player.on('ready', () => {
      if (video.value && player) {
        const duration = player.duration
        if (duration && duration > 0) {
          playHistory.setVideoDuration(video.value.id, duration)
        }
        // 恢复上次播放位置（如果存在）
        const lastPosition = playHistory.getLastPlaybackPosition(video.value.id)
        if (lastPosition && lastPosition > 0) {
          player.currentTime = lastPosition
        }
        // 恢复播放速度
        player.speed = playbackRate.value
      }
    })

    // 监听播放速度变化
    player.on('ratechange', () => {
      if (player) {
        playbackRate.value = player.speed
      }
    })
  }
}

// 加载雪碧图信息和图片
async function loadSprite() {
  if (!video.value?.spritePath) {
    spriteInfo.value = null
    spriteImage.value = null
    spriteLoaded.value = false
    return
  }

  // 加载雪碧图信息
  const info = await store.getSpriteInfo(video.value.spritePath)
  spriteInfo.value = info

  // 预加载雪碧图
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

// 检查 FFmpeg 状态
async function checkFFmpeg() {
  const status = await store.checkFFmpegStatus()
  ffmpegAvailable.value = status.available
  return status
}

// 生成雪碧图
async function generateSpriteSheet() {
  if (!video.value) return

  const ffmpegStatus = await checkFFmpeg()
  if (!ffmpegStatus.available) {
    alert('FFmpeg 未配置，请先按照提示下载并配置 FFmpeg')
    return
  }

  // 检查是否已存在雪碧图
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
  spriteGenStartTime.value = Date.now()

  const result = await store.generateSprite(video.value.videoPath, force)
  if (!result.success) {
    console.error('雪碧图生成失败:', result.message || '生成失败')
    alert(result.message || '生成失败')
    spriteGenerating.value = false
    spriteGenStartTime.value = null
    return
  }

  // 状态将通过 WebSocket 自动更新
}

// 监听 store 中的雪碧图状态变化
function watchSpriteStatus() {
  // 检测雪碧图是否完成生成
  if (video.value) {
    // 尝试查找匹配的状态（通过 normalizePath 确保一致）
    let status = undefined
    const normalizedCurrentPath = normalizePath(video.value.videoPath)
    for (const [key, value] of store.spriteStatusMap.entries()) {
      if (normalizePath(key) === normalizedCurrentPath) {
        status = value
        break
      }
    }

    // 如果完成（100%）
    if (status && status.percent === 100 && !status.error) {
      // 清除生成状态
      spriteGenerating.value = false
      spriteGenStartTime.value = null

      // 重新加载视频列表，以获取新的 spritePath
      store.loadVideos()
    } else if (status && status.error) {
      // 出错时也清除开始时间
      spriteGenerating.value = false
      spriteGenStartTime.value = null
      alert('雪碧图生成失败: ' + (status.errorMessage || '未知错误'))
    } else if (status && status.percent != null && status.percent < 100) {
      // 还在生成中，清除本地生成按钮的状态
      spriteGenerating.value = false
    }
  }
}

onMounted(async () => {
  // 检查 FFmpeg 状态
  await checkFFmpeg()

  playHistory.resetPlayCountMarker()
  window.addEventListener('keydown', handleKeyDown)

  setTimeout(() => {
    loadPlayer()
  }, 100)
})

// 当视频信息加载完成后，加载雪碧图
watch(video, async (newVideo) => {
  if (newVideo) {
    await loadSprite()
  }
}, { immediate: true, deep: true })

// 监听雪碧图状态变化（监听 Map 转成的数组，这样 Map 变化时能触发更新）
watch([
  () => store.spriteInProgress,
  () => Array.from(store.spriteStatusMap.values())
], () => {
  watchSpriteStatus()
}, { deep: true })

watch(() => route.params.id, async (_newId, oldId) => {
  // 切换视频前保存当前视频的播放位置
  if (oldId && player) {
    const currentTime = player.currentTime
    if (currentTime && currentTime > 0) {
      // 直接用 oldId 保存，不要用 saveCurrentPosition()，因为 video.value 已经变了
      playHistory.setLastPlaybackPosition(oldId as string, currentTime)
    }
  }
  playHistory.stopSession()
  playHistory.resetPlayCountMarker()
  // 重置播放速度
  playbackRate.value = 1

  setTimeout(() => {
    loadPlayer()
  }, 50)
})

onBeforeUnmount(() => {
  playHistory.stopSession()
  // 离开页面时保存最后播放位置
  saveCurrentPosition()
  window.removeEventListener('keydown', handleKeyDown)
  // 清理保存位置定时器
  if (savePositionTimer) {
    clearInterval(savePositionTimer)
    savePositionTimer = null
  }
  // 清理 VTT Blob URL
  cleanupVttBlobUrl()
  // 重置进度状态
  spriteGenerating.value = false
  if (player) {
    player.destroy()
    player = null
  }
})
</script>

<style scoped>
/* 让 Plyr 播放器占满整个容器 */
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
</style>

