<template>
  <div class="group bg-slate-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all duration-200">
    <!-- 海报区域 -->
    <div
      @click="$emit('click', video)"
      class="aspect-video bg-slate-700 relative overflow-hidden cursor-pointer"
    >
      <!-- 加载占位 -->
      <div
        v-if="posterUrl && !imageLoaded && !imageError"
        class="absolute inset-0 flex items-center justify-center bg-slate-700"
      >
        <div class="flex flex-col items-center gap-2">
          <div class="w-8 h-8 border-3 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
          <div class="text-2xl">🎬</div>
        </div>
      </div>

      <!-- 图片 -->
      <img
        v-if="posterUrl && !imageError"
        :src="posterUrl"
        :alt="video.title"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        :class="{ 'opacity-0': !imageLoaded, 'opacity-100': imageLoaded }"
        @load="handleImageLoad"
        @error="handleImageError"
      />

      <!-- 无图片时的占位 -->
      <div v-if="!posterUrl || imageError" class="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
        <div class="text-center">
          <div class="text-5xl mb-2">🎬</div>
          <div class="text-slate-500 text-xs">无海报</div>
        </div>
      </div>

      <!-- 质量不好标记 -->
      <div v-if="isBadQuality" class="absolute top-2 left-2">
        <span class="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium shadow-lg">
          🚫 质量不好
        </span>
      </div>

      <!-- 雪碧图已生成标记 -->
      <div v-if="video.spritePath && !isGeneratingSprite" class="absolute top-2 right-2">
        <span class="bg-teal-600/90 text-white text-xs px-2 py-1 rounded font-medium shadow-lg backdrop-blur-sm">
          🗂️ 雪碧图
        </span>
      </div>

      <!-- 雪碧图生成中进度覆盖层 -->
      <div v-if="isGeneratingSprite" class="absolute inset-0 bg-gradient-to-br from-black/80 via-slate-900/70 to-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
        <!-- 顶部图标 -->
        <div class="relative">
          <div v-if="spriteStatus?.status === 'pending'" class="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center">
            <span class="text-2xl">⏳</span>
          </div>
          <div v-else class="w-14 h-14 rounded-full bg-teal-500/20 border-2 border-teal-400/50 flex items-center justify-center">
            <div class="absolute inset-0 rounded-full border-2 border-teal-400/30 animate-ping"></div>
            <div class="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>

        <!-- 状态文字 -->
        <div class="text-center">
          <div class="text-white text-sm font-semibold mb-0.5">
            {{ spriteStatus?.status === 'pending' ? `排队中 #${spriteStatus.queuePosition || '?'}` : '正在生成雪碧图' }}
          </div>
          <div class="text-slate-400 text-xs">
            {{ spriteStatus?.status === 'pending' ? '请稍候...' : (spriteStatus?.stage || '处理中...') }}
          </div>
        </div>

        <!-- 进度条区域 -->
        <div v-if="spriteStatus?.percent != null" class="w-40 space-y-1.5">
          <div class="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
            <div
              class="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 transition-all duration-300 rounded-full"
              :style="{ width: `${Math.min(spriteStatus.percent, 100)}%` }"
            ></div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-teal-400 font-medium">{{ spriteStatus.percent }}%</span>
            <span v-if="spriteStatus.frameCount != null && spriteStatus.totalFrames != null" class="text-slate-500">
              {{ spriteStatus.frameCount }}/{{ spriteStatus.totalFrames }} 帧
            </span>
          </div>
        </div>

        <!-- 取消按钮 -->
        <button
          @click.stop="abortSpriteGeneration"
          class="mt-1 px-3 py-1.5 bg-gradient-to-r from-red-600/80 to-rose-600/80 hover:from-red-600 hover:to-rose-600 text-white text-xs rounded-full transition-all duration-200 shadow-lg shadow-red-900/20 hover:shadow-red-900/40 hover:scale-105 active:scale-95"
        >
          取消生成
        </button>
      </div>

      <!-- 播放按钮覆盖层 -->
      <div v-if="!isGeneratingSprite" class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <div class="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
          <div class="ml-1 text-slate-900 text-2xl">▶</div>
        </div>
      </div>
    </div>

    <!-- 信息区域 -->
    <div class="p-4">
      <h3 class="font-semibold text-white truncate" :title="video.title">
        {{ video.title }}
      </h3>
      <div class="mt-2 space-y-1">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span v-if="video.fileSize" class="shrink-0">
            📦 {{ store.formatFileSize(video.fileSize) }}
          </span>
          <span class="shrink-0 text-blue-400">
            🎬 {{ videoDuration ? playHistory.formatPlayTime(videoDuration) : '--:--' }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="shrink-0 text-slate-500">
            观看时长
          </span>
          <span :class="totalPlayTime > 0 ? 'text-green-400' : 'text-slate-600'" class="shrink-0">
            {{ totalPlayTime > 0 ? playHistory.formatPlayTime(totalPlayTime) : '未观看' }}
          </span>
        </div>
        <!-- 评分（根据标记数量自动计算） -->
        <div class="mt-2">
          <StarRating
            :modelValue="rating"
            readonly
          />
        </div>
      </div>

      <!-- 按钮区域 -->
      <div class="mt-3 pt-3 border-t border-slate-700 flex gap-2">
        <!-- 雪碧图生成按钮 - 按住读条 -->
        <div
          v-if="!video.spritePath && !isGeneratingSprite"
          class="flex-1 relative"
        >
          <!-- 进度条底层 -->
          <div class="absolute inset-0 rounded bg-slate-700/50 overflow-hidden">
            <!-- 进度填充 -->
            <div
              class="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500/40 to-teal-400/60 transition-all duration-75 ease-out"
              :style="{ width: `${generateProgress}%` }"
            >
              <!-- 进度条光泽效果 -->
              <div class="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent"></div>
            </div>
          </div>
          <!-- 按钮内容 -->
          <button
            @mousedown="startGenerateProgress"
            @mouseup="cancelGenerateProgress"
            @mouseleave="cancelGenerateProgress"
            @touchstart.prevent="startGenerateProgress"
            @touchend="cancelGenerateProgress"
            @touchcancel="cancelGenerateProgress"
            class="w-full px-2 py-1 text-[11px] transition-colors flex items-center justify-center gap-1 relative z-10"
            :class="generateProgress > 0 ? 'text-white font-medium' : 'text-teal-400 hover:text-teal-300'"
          >
            <span v-if="generateProgress > 0" class="animate-pulse">⚡</span>
            <span v-else>🗂️</span>
            <span class="hidden sm:inline">
              {{ generateProgress > 0 ? '生成中...' : '生成' }}
            </span>
          </button>
        </div>
        <!-- 如果已经有缩略图，删除按钮占满宽度 -->
        <button
          v-if="video.spritePath || isGeneratingSprite"
          @click.stop="$emit('delete', video)"
          class="flex-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded text-[11px] transition-colors flex items-center justify-center gap-1"
        >
          <span>🗑️</span>
          <span>删除</span>
        </button>
        <!-- 如果没有缩略图且不在生成中，删除按钮在右边 -->
        <button
          v-else
          @click.stop="$emit('delete', video)"
          class="flex-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded text-[11px] transition-colors flex items-center justify-center gap-1"
        >
          <span>🗑️</span>
          <span class="hidden sm:inline">删除</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import StarRating from '@/components/StarRating.vue'
import type { Video, SpriteStatus } from '@/types'

const props = defineProps<{
  video: Video
}>()

defineEmits<{
  click: [video: Video]
  delete: [video: Video]
}>()

const store = useVideoStore()
const playHistory = usePlayHistoryStore()
const imageError = ref(false)
const imageLoaded = ref(false)
const ffmpegAvailable = ref<boolean | null>(null)

// 生成按钮读条进度
const generateProgress = ref(0)
let generateProgressTimer: number | null = null
const GENERATE_HOLD_DURATION = 1000 // 读条满需要按住的时间（毫秒）

const posterUrl = computed(() => {
  if (!props.video.posterPath) return ''
  return store.getImageUrl(props.video)
})

const totalPlayTime = computed(() => playHistory.getTotalPlayTime(props.video.id))
const rating = computed(() => playHistory.getRating(props.video.id))
const isBadQuality = computed(() => playHistory.getIsBadQuality(props.video.id))
const videoDuration = computed(() => {
  // 优先从播放历史获取，如果没有则用 video 对象的 duration
  const savedDuration = playHistory.getVideoDuration(props.video.id)
  return savedDuration ?? props.video.duration
})

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

// 获取当前视频的雪碧图状态
const spriteStatus = computed((): SpriteStatus | undefined => {
  // 尝试查找匹配的状态（通过 normalizePath 确保一致）
  const normalizedCurrentPath = normalizePath(props.video.videoPath)
  for (const status of store.spriteStatusMap.values()) {
    if (status.videoPath && normalizePath(status.videoPath) === normalizedCurrentPath) {
      return status
    }
  }
  return undefined
})

// 是否正在生成雪碧图
const isGeneratingSprite = computed(() => {
  const status = spriteStatus.value
  if (!status) return false
  return (status.status === 'pending' || status.status === 'running') && !status.error
})

function handleImageLoad() {
  imageLoaded.value = true
}

function handleImageError() {
  imageError.value = true
  imageLoaded.value = true
}

// 检查 FFmpeg 状态
async function checkFFmpeg() {
  const status = await store.checkFFmpegStatus()
  ffmpegAvailable.value = status.available
  return status
}

// 按住生成按钮开始读条
function startGenerateProgress() {
  if (generateProgressTimer) return

  const startTime = performance.now()

  const updateProgress = (currentTime: number) => {
    const elapsed = currentTime - startTime
    generateProgress.value = Math.min((elapsed / GENERATE_HOLD_DURATION) * 100, 100)

    if (generateProgress.value >= 100) {
      // 读条满了，触发请求（进度条会通过 isGeneratingSprite 状态变化自动消失）
      generateProgressTimer = null
      generateSpriteSheet()
    } else {
      generateProgressTimer = requestAnimationFrame(updateProgress)
    }
  }
  generateProgressTimer = requestAnimationFrame(updateProgress)
}

// 取消生成读条
function cancelGenerateProgress() {
  if (generateProgressTimer) {
    cancelAnimationFrame(generateProgressTimer)
    generateProgressTimer = null
  }
  generateProgress.value = 0
}

// 生成雪碧图
async function generateSpriteSheet() {
  const ffmpegStatus = await checkFFmpeg()
  if (!ffmpegStatus.available) {
    alert('FFmpeg 未配置，请先配置 FFmpeg')
    return
  }

  // 检查是否已存在雪碧图
  const hasSprite = !!props.video.spritePath
  let force = false

  if (hasSprite) {
    // 已存在则强制重新生成（用户按住按钮即确认）
    force = true
  }

  const result = await store.generateSprite(props.video.videoPath, force)
  if (!result.success) {
    console.error('雪碧图生成失败:', result.message || '生成失败')
    alert(result.message || '生成失败')
    return
  }

  // 状态将通过 WebSocket 自动更新
}

// 取消生成雪碧图
async function abortSpriteGeneration() {
  if (!confirm('确定要取消生成雪碧图吗？')) {
    return
  }

  try {
    const result = await store.abortSprite(props.video.videoPath)
    if (!result.success) {
      alert(result.message || '取消失败')
    }
  } catch (err) {
    console.error('取消生成失败:', err)
    alert('取消失败，请重试')
  }
}


</script>

<style scoped>
img {
  transition: opacity 0.2s ease-in-out;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
</style>
