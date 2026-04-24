<template>
  <div
    @click="$emit('click', video)"
    class="group cursor-pointer bg-slate-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all duration-200"
  >
    <!-- 海报区域 -->
    <div class="aspect-video bg-slate-700 relative overflow-hidden">
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
      <div v-if="video.spritePath" class="absolute top-2 right-2">
        <span class="bg-teal-600/90 text-white text-xs px-2 py-1 rounded font-medium shadow-lg backdrop-blur-sm">
          🗂️ 缩略图
        </span>
      </div>

      <!-- 播放按钮覆盖层 -->
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import StarRating from '@/components/StarRating.vue'
import type { Video } from '@/types'

const props = defineProps<{
  video: Video
}>()

defineEmits<{
  click: [video: Video]
}>()

const store = useVideoStore()
const playHistory = usePlayHistoryStore()
const imageError = ref(false)
const imageLoaded = ref(false)

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

</script>

<style scoped>
img {
  transition: opacity 0.2s ease-in-out;
}
</style>
