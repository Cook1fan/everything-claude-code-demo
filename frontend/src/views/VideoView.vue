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
            <div class="bg-black rounded-xl overflow-hidden shadow-2xl relative" ref="playerContainer">
              <video
                ref="videoRef"
                class="w-full"
                playsinline
                @error="handleVideoError"
              ></video>
              <!-- 进度条预览 - 会被移动到 Plyr 容器中 -->
              <div
                ref="previewContainer"
                v-show="showPreview"
                class="absolute bottom-16 pointer-events-none z-50"
                :style="{ left: previewPosition + 'px', transform: 'translateX(-50%)' }"
              >
                <div class="bg-slate-900 rounded-lg overflow-hidden shadow-2xl border border-slate-700">
                  <canvas
                    ref="previewCanvas"
                    width="160"
                    height="90"
                    class="block"
                  ></canvas>
                  <div class="px-2 py-1 bg-slate-800 text-white text-xs text-center font-mono">
                    {{ formatPreviewTime(previewTime) }}
                  </div>
                </div>
              </div>
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
              <button
                @click="generateSpriteSheet"
                :disabled="spriteGenerating"
                class="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                title="生成雪碧图"
              >
                {{ spriteGenerating ? '⏳ 生成中...' : '🗂️ 生成雪碧图' }}
              </button>
            </div>

            <!-- 雪碧图生成进度条 -->
            <div v-if="spriteGenerating || countdownSeconds > 0" class="mt-4 bg-slate-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-slate-300 mb-2">🗂️ 生成雪碧图</h3>
              <p class="text-slate-400 text-xs mb-2">{{ spriteStatusMessage }}</p>

              <!-- 倒计时显示 -->
              <div v-if="countdownSeconds > 0" class="mb-4">
                <div class="flex items-center justify-center gap-2">
                  <div class="text-4xl font-bold text-teal-400 font-mono">
                    {{ countdownSeconds }}
                  </div>
                  <div class="text-slate-400 text-sm">秒后刷新</div>
                </div>
                <div class="w-full bg-slate-700 rounded-full h-2 overflow-hidden mt-2">
                  <div
                    class="bg-teal-500 h-full rounded-full transition-all duration-1000 ease-linear"
                    :style="{ width: ((3 - countdownSeconds) / 3) * 100 + '%' }"
                  ></div>
                </div>
              </div>

              <!-- 进度条 -->
              <div v-else class="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  class="bg-teal-500 h-full rounded-full transition-all duration-300"
                  :style="{ width: spriteStatusPercent + '%' }"
                ></div>
              </div>
              <p v-if="countdownSeconds === 0" class="text-right text-slate-500 text-xs mt-1">{{ spriteStatusPercent }}%</p>
              <p v-if="spriteFrameCount && countdownSeconds === 0" class="text-slate-400 text-xs mt-2">
                已提取 {{ spriteFrameCount }} / {{ spriteTotalFrames }} 帧
              </p>
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

              <!-- 快速操作按钮 -->
              <div class="mb-4 flex gap-2">
                <button
                  @click="openDirectory"
                  class="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                >
                  📁 打开文件位置
                </button>
                <button
                  @click="openWithLocalPlayer"
                  class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  🎬 本地播放
                </button>
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

              <!-- FFmpeg 提示 -->
              <div v-if="ffmpegAvailable === false && !spriteGenerating" class="mt-4 p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
                <h3 class="text-amber-400 font-semibold text-sm mb-2">⚠️ FFmpeg 未配置</h3>
                <div class="text-amber-300 text-xs space-y-1">
                  <p>要生成雪碧图，请：</p>
                  <ol class="list-decimal list-inside space-y-1">
                    <li>下载 FFmpeg: <a href="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" target="_blank" class="text-blue-400 underline">gyan.dev/ffmpeg</a></li>
                    <li>解压后将 <code class="bg-slate-700 px-1 rounded">ffmpeg.exe</code> 放到项目根目录</li>
                    <li>或在 <code class="bg-slate-700 px-1 rounded">scanner/config.js</code> 中配置 ffmpeg 路径</li>
                  </ol>
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

        <!-- 雪碧图预览 -->
        <div v-if="video?.spritePath" class="bg-slate-800 rounded-xl p-4 mt-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-white font-semibold">🗂️ 雪碧图预览</h3>
            <span v-if="spriteInfo" class="text-slate-400 text-sm">{{ spriteInfo.frameCount }} 帧</span>
          </div>
          <div class="bg-slate-700 rounded-lg overflow-hidden">
            <img
              :src="store.getSpriteUrl(video)"
              class="w-full h-auto"
              alt="雪碧图"
              @load="handleSpriteImageLoad"
            />
          </div>
          <p v-if="spriteInfo" class="text-slate-500 text-xs mt-3">
            每 {{ spriteInfo.interval }} 秒一帧，共 {{ spriteInfo.duration }} 秒
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import type { Video, SpriteInfo } from '@/types'
import StarRating from '@/components/StarRating.vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

const store = useVideoStore()
const playHistory = usePlayHistoryStore()
const router = useRouter()
const route = useRoute()
const videoRef = ref<HTMLVideoElement | null>(null)
const playerContainer = ref<HTMLDivElement | null>(null)
const playError = ref<string | null>(null)
const ffmpegAvailable = ref<boolean | null>(null)
const spriteGenerating = ref(false)
const spriteStatusPolling = ref<number | null>(null)
const spriteStatusPercent = ref(0)
const spriteStatusMessage = ref('')
const spriteFrameCount = ref(0)
const spriteTotalFrames = ref(0)
const countdownTimer = ref<number | null>(null)
const countdownSeconds = ref(0)
const spriteInfo = ref<SpriteInfo | null>(null)
const spriteImage = ref<HTMLImageElement | null>(null)
const spriteLoaded = ref(false)
let player: Plyr | null = null
let isPlaying = false
let globalMouseHandlerAdded = false
let savePositionTimer: number | null = null

// 进度条预览相关
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewContainer = ref<HTMLDivElement | null>(null)
const showPreview = ref(false)
const previewPosition = ref(0)
const previewTime = ref(0)
let seekTimeout: number | null = null
let progressContainer: HTMLElement | null = null

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

// 处理雪碧图图片加载
function handleSpriteImageLoad() {
  // 雪碧图加载完成
}

// 格式化预览时间
function formatPreviewTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 处理进度条鼠标移动 - 这个函数现在不再使用，保留以防万一
function handlePreviewMouseMove(e: MouseEvent) {
  handleGlobalMouseMove(e)
}

// 从雪碧图中提取帧
function captureFrameFromSprite(targetTime: number) {
  if (!spriteInfo.value || !spriteImage.value || !previewCanvas.value) return

  const info = spriteInfo.value
  const spriteImg = spriteImage.value
  const canvas = previewCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 找到最接近的帧
  let frameIndex = Math.floor(targetTime / info.interval)
  frameIndex = Math.max(0, Math.min(frameIndex, info.frameCount - 1))

  const frame = info.frames[frameIndex]
  if (!frame) return

  // 计算缩略图高度（假设 16:9）
  const thumbnailHeight = info.thumbnailWidth * 9 / 16

  // 从雪碧图中裁剪并绘制到预览画布
  try {
    ctx.drawImage(
      spriteImg,
      frame.x, frame.y, info.thumbnailWidth, thumbnailHeight,
      0, 0, canvas.width, canvas.height
    )
  } catch (e) {
    console.error('从雪碧图提取帧失败:', e)
  }
}

// 处理进度条鼠标离开
function handlePreviewMouseLeave() {
  showPreview.value = false
  if (seekTimeout) {
    clearTimeout(seekTimeout)
    seekTimeout = null
  }
}

// 捕获预览画面到 Canvas
function capturePreviewFrame() {
  if (!videoRef.value || !previewCanvas.value) return

  const canvas = previewCanvas.value
  const video = videoRef.value
  const ctx = canvas.getContext('2d')

  if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
    // 计算保持 16:9 比例的裁剪区域
    const targetRatio = 16 / 9
    const videoRatio = video.videoWidth / video.videoHeight

    let sourceX = 0
    let sourceY = 0
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight

    if (videoRatio > targetRatio) {
      // 视频太宽，裁剪左右
      sourceWidth = video.videoHeight * targetRatio
      sourceX = (video.videoWidth - sourceWidth) / 2
    } else {
      // 视频太高，裁剪上下
      sourceHeight = video.videoWidth / targetRatio
      sourceY = (video.videoHeight - sourceHeight) / 2
    }

    try {
      ctx.drawImage(
        video,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height
      )
    } catch (e) {
      // 忽略绘制错误
    }
  }
}

// 设置进度条预览事件 - 现在什么都不做，因为我们直接在 onMounted 添加了
function setupProgressPreview() {
  console.log('setupProgressPreview 被调用 (跳过，已在 onMounted 添加)')
}

// 清理进度条预览
function cleanupProgressPreview() {
  if (seekTimeout) {
    clearTimeout(seekTimeout)
    seekTimeout = null
  }
  showPreview.value = false
}

// 把预览容器移到 Plyr 容器中
function movePreviewToPlyrContainer() {
  if (!player || !previewContainer.value) return

  const plyrContainer = player.elements.container
  const previewEl = previewContainer.value

  if (plyrContainer && previewEl && !plyrContainer.contains(previewEl)) {
    // 确保 Plyr 容器是 relative 定位
    plyrContainer.style.position = 'relative'
    // 把预览容器移到 Plyr 容器里
    plyrContainer.appendChild(previewEl)
    // 修改样式，适配 Plyr 容器
    previewEl.style.position = 'absolute'
    previewEl.style.bottom = '64px'
    previewEl.style.left = '0'
    // 去掉原来的 left style，因为我们要用 previewPosition 来控制
  }
}

// 全局鼠标移动处理
function handleGlobalMouseMove(e: MouseEvent) {
  if (!player || !previewCanvas.value || !previewContainer.value) {
    return
  }

  // 确保预览容器在 Plyr 里
  movePreviewToPlyrContainer()

  // 找到进度条元素
  const progressBar = player.elements.container?.querySelector('.plyr__progress')
  if (!progressBar) return

  // 检查鼠标是否在进度条上方
  const progressRect = progressBar.getBoundingClientRect()
  const isOverProgress =
    e.clientX >= progressRect.left &&
    e.clientX <= progressRect.right &&
    e.clientY >= progressRect.top &&
    e.clientY <= progressRect.bottom

  if (!isOverProgress) {
    showPreview.value = false
    return
  }

  // 计算相对于 Plyr 容器的位置
  const plyrContainerRect = player.elements.container!.getBoundingClientRect()
  const relativeX = e.clientX - plyrContainerRect.left

  // 更新预览位置和状态
  previewPosition.value = relativeX
  showPreview.value = true

  // 计算时间
  const percent = Math.max(0, Math.min(1, (e.clientX - progressRect.left) / progressRect.width))
  const duration = player.duration || 0
  const targetTime = percent * duration
  previewTime.value = targetTime

  // 如果有雪碧图，直接从雪碧图提取帧
  if (spriteLoaded.value && spriteInfo.value && spriteImage.value) {
    captureFrameFromSprite(targetTime)
  }
}

// 保存当前播放位置
function saveCurrentPosition() {
  if (!player || !video.value) return
  const currentTime = player.currentTime
  if (currentTime && currentTime > 0) {
    playHistory.setLastPlaybackPosition(video.value.id, currentTime)
  }
}

function loadPlayer() {
  if (!videoRef.value || !video.value) return

  playError.value = null

  if (player) {
    cleanupProgressPreview()
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
    // 重新设置进度条预览
    setTimeout(() => {
      setupProgressPreview()
    }, 100)
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
        // 恢复上次播放位置
        const lastPosition = playHistory.getLastPlaybackPosition(video.value.id)
        if (lastPosition && lastPosition > 0 && lastPosition < duration) {
          player.currentTime = lastPosition
        }
      }
    })

    // 监听播放器 ready 事件，也尝试获取时长和恢复播放位置
    player.on('ready', () => {
      if (video.value && player) {
        const duration = player.duration
        if (duration && duration > 0) {
          playHistory.setVideoDuration(video.value.id, duration)
        }
        // 恢复上次播放位置
        const lastPosition = playHistory.getLastPlaybackPosition(video.value.id)
        if (lastPosition && lastPosition > 0) {
          player.currentTime = lastPosition
        }
      }
      // 设置进度条预览
      setTimeout(() => {
        setupProgressPreview()
      }, 100)
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
    img.onerror = (error) => {
      console.error('雪碧图图片加载失败:', error)
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

  // 重置进度状态
  spriteStatusPercent.value = 0
  spriteStatusMessage.value = '正在初始化...'
  spriteFrameCount.value = 0
  spriteTotalFrames.value = 0
  spriteGenerating.value = true

  const result = await store.generateSprite(video.value.videoPath, force)
  if (!result.success) {
    console.error('雪碧图生成失败:', result.message || '生成失败')
    alert(result.message || '生成失败')
    spriteGenerating.value = false
    return
  }

  // 轮询状态
  spriteStatusPolling.value = window.setInterval(async () => {
    const status = await store.getSpriteStatus()

    // 更新进度显示
    if (status.status) {
      spriteStatusPercent.value = status.status.percent || 0
      spriteStatusMessage.value = status.status.message || '处理中...'
      spriteFrameCount.value = status.status.frameCount || 0
      spriteTotalFrames.value = status.status.totalFrames || 0
    }

    if (!status.inProgress) {
      if (status.status?.error) {
        console.error('雪碧图生成失败:', status.status.message)
        alert('雪碧图生成失败: ' + status.status.message)
        if (spriteStatusPolling.value) {
          clearInterval(spriteStatusPolling.value)
          spriteStatusPolling.value = null
        }
        spriteGenerating.value = false
      } else if (spriteStatusPercent.value >= 100) {
        // 达到100%后显示倒计时再刷新页面
        spriteStatusMessage.value = '生成完成！'
        if (spriteStatusPolling.value) {
          clearInterval(spriteStatusPolling.value)
          spriteStatusPolling.value = null
        }
        // 开始倒计时
        countdownSeconds.value = 3
        countdownTimer.value = window.setInterval(() => {
          countdownSeconds.value--
          if (countdownSeconds.value <= 0) {
            if (countdownTimer.value) {
              clearInterval(countdownTimer.value)
              countdownTimer.value = null
            }
            location.reload()
          }
        }, 1000)
      } else {
        if (spriteStatusPolling.value) {
          clearInterval(spriteStatusPolling.value)
          spriteStatusPolling.value = null
        }
        spriteGenerating.value = false
      }
    }
  }, 500)
}

onMounted(async () => {
  if (store.videos.length === 0) {
    await store.loadVideos()
  }

  // 检查 FFmpeg 状态
  await checkFFmpeg()

  playHistory.resetPlayCountMarker()
  window.addEventListener('keydown', handleKeyDown)

  // 添加全局鼠标监听
  window.addEventListener('mousemove', handleGlobalMouseMove)
  globalMouseHandlerAdded = true

  setTimeout(() => {
    loadPlayer()
  }, 100)
})

// 当视频信息加载完成后，加载雪碧图
watch(video, async (newVideo) => {
  console.log('video 变化了:', newVideo)
  if (newVideo) {
    await loadSprite()
  }
}, { immediate: true })

watch(() => route.params.id, async (newId, oldId) => {
  // 切换视频前保存当前视频的播放位置
  if (oldId) {
    saveCurrentPosition()
  }
  cleanupProgressPreview()
  playHistory.stopSession()
  playHistory.resetPlayCountMarker()

  setTimeout(() => {
    loadPlayer()
  }, 50)
})

onBeforeUnmount(() => {
  cleanupProgressPreview()
  playHistory.stopSession()
  // 离开页面时保存最后播放位置
  saveCurrentPosition()
  window.removeEventListener('keydown', handleKeyDown)
  // 清理全局鼠标监听
  if (globalMouseHandlerAdded) {
    window.removeEventListener('mousemove', handleGlobalMouseMove)
    globalMouseHandlerAdded = false
  }
  // 清理保存位置定时器
  if (savePositionTimer) {
    clearInterval(savePositionTimer)
    savePositionTimer = null
  }
  if (spriteStatusPolling.value) {
    clearInterval(spriteStatusPolling.value)
    spriteStatusPolling.value = null
  }
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
  // 重置进度状态
  spriteStatusPercent.value = 0
  spriteStatusMessage.value = ''
  spriteFrameCount.value = 0
  spriteTotalFrames.value = 0
  countdownSeconds.value = 0
  spriteGenerating.value = false
  if (player) {
    player.destroy()
    player = null
  }
})
</script>
