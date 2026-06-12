<template>
  <aside
    :class="[
      'related-video-list flex h-full bg-slate-900/40 transition-[width] duration-200 ease-out',
      collapsed ? 'w-10' : 'w-72'
    ]"
  >
    <!-- 折叠态：窄条 -->
    <div
      v-if="collapsed"
      class="w-10 flex flex-col items-center border-l border-slate-700/60"
    >
      <button
        type="button"
        @click="collapsed = false"
        class="mt-2 w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors"
        title="展开侧栏"
        aria-label="展开侧栏"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div
        class="flex-1 flex items-center justify-center"
        :title="`接下来播放 ${relatedVideos.length} 个`"
      >
        <span
          class="text-slate-300 text-xs font-medium tracking-wider whitespace-nowrap select-none"
          style="writing-mode: vertical-rl; transform: rotate(180deg);"
        >
          接下来播放
        </span>
      </div>

      <span class="mb-2 text-slate-500 text-[11px] font-medium tabular-nums">
        {{ relatedVideos.length }}
      </span>
    </div>

    <!-- 展开态：列表 -->
    <div v-else class="flex-1 flex flex-col min-w-0">
      <header class="px-3 py-2.5 border-b border-slate-700/60 shrink-0 flex items-center gap-2">
        <h2 class="text-white font-semibold text-sm flex-1 truncate">接下来播放</h2>
        <span class="text-slate-400 text-xs tabular-nums">{{ relatedVideos.length }}</span>
        <button
          type="button"
          @click="collapsed = true"
          class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-700/70 text-slate-400 hover:text-white transition-colors -mr-1"
          title="收起侧栏"
          aria-label="收起侧栏"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        <div
          v-if="relatedVideos.length === 0"
          class="px-3 py-8 text-center text-slate-500 text-sm"
        >
          该目录下没有其他视频
        </div>

        <button
          v-for="item in relatedVideos"
          :key="item.video.id"
          type="button"
          :class="[
            'group w-full text-left flex gap-2.5 rounded-lg p-1.5 transition-colors',
            item.isCurrent
              ? 'bg-blue-600/20 ring-1 ring-blue-500/60 cursor-default'
              : 'hover:bg-slate-800/70 cursor-pointer'
          ]"
          :disabled="item.isCurrent"
          @click="!item.isCurrent && emit('select', item.video)"
        >
          <!-- 缩略图 -->
          <div class="relative w-28 aspect-video shrink-0 rounded-md overflow-hidden bg-slate-700">
            <img
              v-if="item.posterUrl"
              :src="item.posterUrl"
              :alt="item.video.title"
              loading="lazy"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-xl">
              🎬
            </div>

            <!-- 时长叠加 -->
            <div
              v-if="item.durationLabel"
              class="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-white text-[10px] font-mono"
            >
              {{ item.durationLabel }}
            </div>

            <!-- 正在播放标记 -->
            <div
              v-if="item.isCurrent"
              class="absolute inset-0 bg-black/60 flex items-center justify-center"
            >
              <span class="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                正在播放
              </span>
            </div>

            <!-- 雪碧图 / 质量 标记 -->
            <div v-else-if="item.isBadQuality" class="absolute top-1 left-1">
              <span class="bg-red-600/90 text-white text-[10px] px-1 py-0.5 rounded">
                🚫
              </span>
            </div>
            <div v-else-if="item.hasSprite" class="absolute top-1 left-1">
              <span class="bg-teal-600/90 text-white text-[10px] px-1 py-0.5 rounded">
                🗂️
              </span>
            </div>
          </div>

          <!-- 文本信息 -->
          <div class="flex-1 min-w-0 flex flex-col">
            <h3
              :class="[
                'text-[13px] font-medium leading-snug line-clamp-2',
                item.isCurrent ? 'text-blue-300' : 'text-slate-100 group-hover:text-white'
              ]"
              :title="item.video.title"
            >
              {{ item.video.title }}
            </h3>

            <div class="mt-auto flex items-center gap-2 text-[11px] text-slate-400">
              <span v-if="item.rating > 0" class="text-amber-400" :title="`评分 ${item.rating}/10`">
                ⭐ {{ item.rating }}
              </span>
              <span v-if="item.playCount > 0" :title="`已播放 ${item.playCount} 次`">
                ▶ {{ item.playCount }}
              </span>
              <span v-if="item.fileSizeLabel" class="ml-auto text-slate-500">
                {{ item.fileSizeLabel }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { Video } from '@/types'
import { useVideoStore } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'

interface Props {
  currentVideo: Video
}

interface RelatedVideoItem {
  video: Video
  isCurrent: boolean
  posterUrl: string
  durationLabel: string
  fileSizeLabel: string
  rating: number
  playCount: number
  hasSprite: boolean
  isBadQuality: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select', video: Video): void
}>()

const store = useVideoStore()
const playHistory = usePlayHistoryStore()

// 折叠状态：localStorage 持久化
const STORAGE_KEY = 'video-view-related-collapsed'
const collapsed = ref(true)

onMounted(() => {
  try {
    collapsed.value = localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    // 忽略 localStorage 访问异常
  }
})

watch(collapsed, value => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // 忽略 localStorage 写入异常
  }
})

// 目录展示：用最后一段做主要标识，整路径作为 tooltip
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

// 同目录视频，自然标题排序，当前视频置顶
const relatedVideos = computed<RelatedVideoItem[]>(() => {
  const currentDir = props.currentVideo.directory
  if (!currentDir) return []

  const sameDir = store.videos
    .filter(v => v.directory === currentDir)
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN', { numeric: true }))

  // 把当前视频排到首位
  const currentIndex = sameDir.findIndex(v => v.id === props.currentVideo.id)
  const ordered = currentIndex >= 0
    ? [sameDir[currentIndex], ...sameDir.slice(0, currentIndex), ...sameDir.slice(currentIndex + 1)]
    : sameDir

  return ordered.map<RelatedVideoItem>(video => ({
    video,
    isCurrent: video.id === props.currentVideo.id,
    posterUrl: video.posterPath ? store.getImageUrl(video) : '',
    durationLabel: formatDuration(video.duration ?? playHistory.getRecord(video.id)?.videoDuration),
    fileSizeLabel: store.formatFileSize(video.fileSize),
    rating: playHistory.getRating(video.id),
    playCount: playHistory.getPlayCount(video.id),
    hasSprite: !!video.spritePath,
    isBadQuality: playHistory.getIsBadQuality(video.id),
  }))
})
</script>

<style scoped>
.related-video-list :deep(.line-clamp-2) {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 滚动条主题 */
.related-video-list ::-webkit-scrollbar {
  width: 6px;
}
.related-video-list ::-webkit-scrollbar-track {
  background: transparent;
}
.related-video-list ::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}
.related-video-list ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
