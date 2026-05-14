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
          🗂️ 缩略图
        </span>
      </div>

      <!-- 雪碧图生成中进度覆盖层 -->
      <div v-if="isGeneratingSprite" class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
        <div class="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <div class="text-white text-xs font-medium">
          {{ spriteStatus?.status === 'pending' ? `排队中 #${spriteStatus.queuePosition || '?'}` : '生成中...' }}
        </div>
        <div v-if="spriteStatus?.percent != null" class="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full bg-teal-500 transition-all duration-200" :style="{ width: `${spriteStatus.percent}%` }"></div>
        </div>
        <div v-if="spriteStatus?.percent != null" class="text-teal-400 text-xs">
          {{ spriteStatus.percent }}%
        </div>
        <button
          @click.stop="abortSpriteGeneration"
          class="mt-1 px-2 py-0.5 bg-red-600/80 hover:bg-red-600 text-white text-xs rounded transition-colors"
        >
          取消
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
        <!-- 评分 -->
        <div class="mt-2">
          <StarRating
            :modelValue="rating"
            @update:modelValue="setRating"
            readonly
          />
        </div>
      </div>

      <!-- 按钮区域 -->
      <div class="mt-3 pt-3 border-t border-slate-700 flex gap-2">
        <!-- 雪碧图生成按钮 -->
        <button
          v-if="!video.spritePath && !isGeneratingSprite"
          @click.stop="generateSpriteSheet"
          :disabled="isGeneratingSprite"
          class="flex-1 px-2 py-1 bg-teal-600/20 hover:bg-teal-600/40 disabled:bg-slate-600/20 disabled:cursor-not-allowed text-teal-400 hover:text-teal-300 disabled:text-slate-500 rounded text-[11px] transition-colors flex items-center justify-center gap-1"
        >
          <span>🗂️</span>
          <span class="hidden sm:inline">生成</span>
        </button>
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
  for (const [key, value] of store.spriteStatusMap.entries()) {
    if (normalizePath(key) === normalizedCurrentPath) {
      return value
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

function setRating(value: number) {
  playHistory.setRating(props.video.id, value)
}

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
    if (!confirm('该视频已生成过雪碧图，是否要重新生成？\n（重新生成会覆盖旧的雪碧图）')) {
      return
    }
    force = true
  } else {
    if (!confirm('生成雪碧图可能需要几分钟时间，确定要继续吗？')) {
      return
    }
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
</style>
