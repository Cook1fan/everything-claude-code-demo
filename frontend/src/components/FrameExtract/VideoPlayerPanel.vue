<template>
  <main class="flex-1 flex flex-col bg-black">
    <div class="flex-1 flex items-center justify-center bg-black relative">
      <video
        v-if="selectedVideo"
        ref="videoRef"
        class="max-h-full max-w-full"
        :src="store.getVideoUrl(selectedVideo)"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onVideoLoaded"
        @click="togglePlay"
      />
      <div v-else class="text-slate-500 text-center">
        <div class="text-4xl mb-2">🎬</div>
        <div class="text-sm">请选择视频</div>
      </div>
    </div>

    <!-- 播放控制栏 -->
    <div class="bg-slate-850 border-t border-slate-700 p-4">
      <div class="flex items-center justify-center gap-3">
        <button
          @click="jumpToStartTime"
          class="px-2.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-all duration-200"
          title="到开始时间"
        >
          ⏮
        </button>
        <button
          @click="skipBackward"
          class="px-2.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-all duration-200"
          title="后退5秒"
        >
          ⏪
        </button>
        <button
          @click="togglePlay"
          class="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full transition-all duration-200 shadow-lg shadow-blue-900/30"
        >
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
        <button
          @click="skipForward"
          class="px-2.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-all duration-200"
          title="前进5秒"
        >
          ⏩
        </button>
        <button
          @click="jumpToEndTime"
          class="px-2.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-all duration-200"
          title="到结束时间"
        >
          ⏭
        </button>
        <div class="flex items-center gap-2 ml-6 border-l border-slate-700 pl-3">
          <span class="text-xs text-slate-500">倍速</span>
          <select
            v-model="playbackRate"
            @change="onPlaybackRateChange"
            class="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-blue-500"
          >
            <option :value="0.5">0.5x</option>
            <option :value="0.75">0.75x</option>
            <option :value="1">1x</option>
            <option :value="1.25">1.25x</option>
            <option :value="1.5">1.5x</option>
            <option :value="2">2x</option>
          </select>
        </div>
        <div class="ml-auto text-slate-400 text-sm font-mono">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import type { Video } from '@/types'

const store = useVideoStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)
const isPreviewing = ref(false)

interface Props {
  selectedVideo: Video | null
  selectedStartTime: number
  selectedEndTime: number
  isDragging?: boolean
}

const props = defineProps<Props>()

interface Emits {
  (e: 'timeUpdate', time: number): void
  (e: 'durationChange', duration: number): void
}

const emit = defineEmits<Emits>()

watch(() => props.selectedVideo, () => {
  resetPlayer()
})

function resetPlayer() {
  currentTime.value = 0
  isPlaying.value = false
  if (videoRef.value) {
    videoRef.value.currentTime = 0
    videoRef.value.pause()
  }
}

function togglePlay() {
  if (!videoRef.value || !props.selectedVideo) return
  if (videoRef.value.paused) {
    videoRef.value.play()
    isPlaying.value = true
  } else {
    videoRef.value.pause()
    isPlaying.value = false
  }
}

function skipBackward() {
  if (!videoRef.value) return
  videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime - 5)
}

function skipForward() {
  if (!videoRef.value) return
  videoRef.value.currentTime = Math.min(duration.value, videoRef.value.currentTime + 5)
}

function jumpToStartTime() {
  if (!videoRef.value) return
  videoRef.value.currentTime = props.selectedStartTime
}

function jumpToEndTime() {
  if (!videoRef.value) return
  videoRef.value.currentTime = props.selectedEndTime
}

function onPlaybackRateChange() {
  if (videoRef.value) {
    videoRef.value.playbackRate = playbackRate.value
  }
}

function onTimeUpdate() {
  if (videoRef.value && !isPreviewing.value && !props.isDragging) {
    currentTime.value = videoRef.value.currentTime
    emit('timeUpdate', currentTime.value)
  }
}

function onVideoLoaded() {
  if (videoRef.value && props.selectedVideo) {
    const newDuration = videoRef.value.duration
    if (newDuration && newDuration > 0) {
      duration.value = newDuration
      emit('durationChange', newDuration)
    }
  }
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// 暴露给父组件的方法
defineExpose({
  videoRef,
  setCurrentTime: (time: number) => {
    if (videoRef.value) {
      videoRef.value.currentTime = time
      currentTime.value = time
    }
  },
  startPreview: () => {
    isPreviewing.value = true
  },
  stopPreview: () => {
    isPreviewing.value = false
  }
})
</script>

<style scoped>
.bg-slate-850 {
  background-color: #0f172a;
}
</style>