<template>
  <aside class="w-72 bg-slate-850 border-r border-slate-700 flex flex-col">
    <div class="p-4 border-b border-slate-700">
      <h2 class="text-sm font-semibold text-slate-200 mb-3">视频列表</h2>
      <input
        v-model="videoSearchQuery"
        type="text"
        placeholder="搜索视频..."
        class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <div
        v-for="video in filteredVideos"
        :key="video.id"
        class="group relative mb-1.5"
      >
        <div
          @click="selectVideo(video)"
          :class="[
            'p-3 rounded cursor-pointer transition-all duration-200',
            selectedVideo?.id === video.id
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-750 hover:bg-slate-700 text-slate-200 border border-transparent hover:border-slate-600'
          ]"
        >
          <div class="text-sm font-medium truncate pr-8">{{ video.title }}</div>
          <div class="text-xs text-slate-400 mt-1">
            {{ formatDuration(playHistoryStore.getVideoDuration(video.id) || video.duration || 0) }}
          </div>
        </div>
        <button
          @click.stop="removeVideo(video)"
          class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="从列表中删除"
        >
          ×
        </button>
      </div>
      <div v-if="filteredVideos.length === 0" class="text-center py-8 text-slate-500 text-sm">
        暂无视频
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import type { Video } from '@/types'

const store = useVideoStore()
const playHistoryStore = usePlayHistoryStore()

const videoSearchQuery = ref('')

interface Props {
  selectedVideo: Video | null
  videos?: Video[]
}

const props = withDefaults(defineProps<Props>(), {
  videos: () => []
})

interface Emits {
  (e: 'select', video: Video): void
  (e: 'remove', videoId: string): void
}

const emit = defineEmits<Emits>()

function removeVideo(video: Video) {
  emit('remove', video.id)
}

const filteredVideos = computed(() => {
  if (!videoSearchQuery.value) return props.videos
  const query = videoSearchQuery.value.toLowerCase()
  return props.videos.filter(v => v.title.toLowerCase().includes(query))
})

function selectVideo(video: Video) {
  emit('select', video)
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '--:--'
  if (seconds < 60) return `${Math.round(seconds)}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}小时${m}分`
}

onMounted(async () => {
  await playHistoryStore.initialize()
})
</script>

<style scoped>
::-webkit-scrollbar {
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

.bg-slate-850 {
  background-color: #0f172a;
}

.bg-slate-750 {
  background-color: #1e293b;
}
</style>
