<template>
  <div class="h-56 bg-slate-850 border-t border-slate-700 flex flex-col">
    <div class="flex items-center justify-between px-6 py-3 border-b border-slate-700">
      <h3 class="text-sm font-semibold text-slate-200">时间轴</h3>
    </div>

    <div class="flex-1 relative flex flex-col px-6 py-4 overflow-hidden">
      <!-- 时间刻度层 - 放在滚动容器外面，独立滚动 -->
      <div class="h-8 flex items-end select-none relative overflow-hidden mb-1">
        <div
          class="absolute bottom-0 left-0 h-full"
          ref="timelineRulerRef"
          :style="{ width: (getTotalDuration() * basePixelsPerSecond) + 'px', transform: `translateX(${-scrollLeft}px)` }"
        >
          <div
            v-for="tick in minorTicks"
            :key="'minor-' + tick.position"
            class="absolute bottom-0"
            :style="{ left: (tick.position * basePixelsPerSecond) + 'px' }"
          >
            <div class="w-px h-1 bg-slate-700"></div>
          </div>
          <div
            v-for="tick in timelineTicks"
            :key="'major-' + tick.position"
            class="absolute bottom-0"
            :style="{ left: (tick.position * basePixelsPerSecond) + 'px' }"
          >
            <div class="w-px h-3 bg-slate-500"></div>
            <div class="text-[10px] text-slate-400 mt-1.5 -ml-6 w-12 text-center font-mono">
              {{ formatTime(tick.time) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 视频轨道层 - 宽度由 timelineWidth 决定，决定滚动区域 -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden" ref="timelineScrollRef" @scroll="onScroll">
        <div
          class="relative h-full"
          ref="timelineContentRef"
          :style="{ width: timelineWidth > 0 ? timelineWidth + 'px' : 'auto', minWidth: '100%' }"
        >
          <div
            class="relative h-32 cursor-crosshair"
            :style="{ width: timelineWidth > 0 ? timelineWidth + 'px' : '100%' }"
            @click="onTimelineClick"
            @mousemove="onTimelineMouseMove"
            @mouseleave="onTimelineMouseLeave"
          >
            <div
              v-if="!selectedVideo"
              class="h-32 w-full bg-slate-800/50 border-2 border-dashed border-slate-700 flex items-start justify-start pt-4 pl-4"
            >
              <div class="text-slate-500 text-sm flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 012-2V8a2 2 0 00-2-2H5a2 2 0 002 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
                <span>从左侧选择视频添加到时间轴</span>
              </div>
            </div>

            <div v-else class="absolute top-0 left-0 h-full bg-slate-800 overflow-hidden border border-slate-700" :style="{ width: (duration > 0 ? duration * basePixelsPerSecond : 800) + 'px' }">
              <div class="h-full flex items-center px-1">
                <div class="h-24 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 relative overflow-hidden border border-slate-500/30">
                  <div class="absolute inset-0 opacity-30">
                    <div
                      v-for="i in 20"
                      :key="i"
                      class="absolute top-0 bottom-0 w-px bg-white/10"
                      :style="{ left: (i * 5) + '%' }"
                    ></div>
                  </div>
                  <div class="absolute left-3 top-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-md">
                    <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 012-2V8a2 2 0 00-2-2H5a2 2 0 002 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                    <span class="text-white text-xs font-medium truncate max-w-[150px]">{{ selectedVideo.title }}</span>
                    <span class="text-slate-400 text-xs font-mono">{{ formatTime(duration) }}</span>
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 h-12 opacity-40">
                    <svg class="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.8" />
                          <stop offset="100%" style="stop-color:#1e40af;stop-opacity:0.3" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,32 Q50,10 100,32 T200,32 T300,32 T400,32 T500,32 T600,32 T700,32 T800,32 T900,32 T1000,32 T1100,32 T1200,32 V48 H0 Z"
                        fill="url(#waveGradient)"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div
                class="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500/20 via-blue-400/30 to-blue-500/20 border-l-2 border-r-2 border-blue-500 z-10 pointer-events-none"
                :style="{
                  left: (selectedStartTime * basePixelsPerSecond) + 'px',
                  width: ((selectedEndTime - selectedStartTime) * basePixelsPerSecond) + 'px'
                }"
              >
                <div class="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
              </div>

              <div
                class="absolute top-0 bottom-0 w-10 cursor-ew-resize group z-20"
                :style="{ left: (selectedStartTime * basePixelsPerSecond) + 'px', transform: 'translateX(-50%)' }"
                @mousedown.stop="startDragging('start', $event)"
              >
                <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-emerald-500 -translate-x-1/2 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div class="bg-emerald-500 text-white px-2 py-1 rounded-md shadow-lg shadow-emerald-500/40 border border-emerald-300/50 flex flex-col items-center">
                    <div class="flex gap-0.5 mb-0.5">
                      <div class="w-1 h-2 bg-white/60 rounded-full"></div>
                      <div class="w-1 h-2 bg-white/60 rounded-full"></div>
                      <div class="w-1 h-2 bg-white/60 rounded-full"></div>
                    </div>
                    <span class="text-[9px] font-bold leading-none">入</span>
                  </div>
                </div>
              </div>

              <div
                class="absolute top-0 bottom-0 w-10 cursor-ew-resize group z-20"
                :style="{ left: (selectedEndTime * basePixelsPerSecond) + 'px', transform: 'translateX(-50%)' }"
                @mousedown.stop="startDragging('end', $event)"
              >
                <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-rose-500 -translate-x-1/2 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div class="bg-rose-500 text-white px-2 py-1 rounded-md shadow-lg shadow-rose-500/40 border border-rose-300/50 flex flex-col items-center">
                    <span class="text-[9px] font-bold leading-none mb-0.5">出</span>
                    <div class="flex gap-0.5">
                      <div class="w-1 h-2 bg-white/60 rounded-full"></div>
                      <div class="w-1 h-2 bg-white/60 rounded-full"></div>
                      <div class="w-1 h-2 bg-white/60 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 预览轴 - 黄色的线，鼠标悬停时显示 -->
              <div
                v-if="hoverPreview.show"
                class="absolute top-0 bottom-0 w-px z-30 pointer-events-none"
                :style="{ left: (hoverPreview.time * basePixelsPerSecond) + 'px' }"
              >
                <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0">
                  <div class="w-3 h-3 bg-yellow-400 rotate-45 -translate-y-1.5"></div>
                </div>
                <div class="w-px h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]"></div>
              </div>

              <!-- 播放头 - 白色的线，只有点击时才移动 -->
              <div
                class="absolute top-0 bottom-0 w-px z-25 pointer-events-none"
                :style="{ left: (currentTime * basePixelsPerSecond) + 'px' }"
              >
                <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0">
                  <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-transparent border-t-white"></div>
                </div>
                <div class="w-0.5 h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-slate-500 mt-2">
        <div class="flex items-center gap-2">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <input
              type="text"
              :value="formatTime(selectedStartTime)"
              @change="onStartTimeInput"
              class="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </span>
          <span class="text-slate-700">-</span>
          <input
            type="text"
            :value="formatTime(selectedEndTime)"
            @change="onEndTimeInput"
            class="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-rose-400 font-mono text-xs focus:outline-none focus:border-rose-500"
          />
          <span class="text-slate-700 ml-2">|</span>
          <span class="font-mono text-white ml-2">{{ formatTime(selectedEndTime - selectedStartTime) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-mono">当前: {{ formatTime(currentTime) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import type { Video } from '@/types'

interface Props {
  selectedVideo: Video | null
  duration: number
  currentTime: number
  selectedStartTime: number
  selectedEndTime: number
  isDragging: boolean // 来自父组件，表示是否正在拖动
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:currentTime', time: number): void
  (e: 'update:selectedStartTime', time: number): void
  (e: 'update:selectedEndTime', time: number): void
  (e: 'previewTime', time: number): void
  (e: 'stopPreview'): void
  (e: 'draggingChange', isDragging: boolean): void // 通知父组件拖动状态变化
}

const emit = defineEmits<Emits>()

// 固定的基础像素/秒，始终保持一致
const basePixelsPerSecond = computed(() => {
  // 始终使用固定的像素比例，保持刻度间距一致
  return 0.15 // 1秒=0.15像素，30分钟=2700像素，小刻度6分钟=540像素
})

// 获取总时长 - 时间刻度始终显示24小时，无限延伸
const getTotalDuration = () => {
  return 86400 // 始终24小时
}

// 计算时间轴总宽度 - 只由视频轨道长度决定，无视频时只有最小宽度
const timelineWidth = computed(() => {
  if (!props.selectedVideo) {
    return 0 // 无视频时宽度为0，不产生滚动条
  }
  const total = props.duration || 0 // 使用视频实际时长
  const baseWidth = total * basePixelsPerSecond.value
  // 如果 duration 为 0（视频未加载），给一个最小宽度；否则按视频长度
  return total > 0 ? Math.max(800, baseWidth + 50) : 800
})

const isDragging = ref(false)
const dragType = ref<'start' | 'end' | null>(null)
const hoverPreview = ref({
  show: false,
  time: 0
})

const timelineScrollRef = ref<HTMLElement | null>(null)
const timelineContentRef = ref<HTMLElement | null>(null)
const timelineRulerRef = ref<HTMLElement | null>(null)
const scrollLeft = ref(0)

const timelineTicks = computed(() => {
  const total = getTotalDuration()
  // 始终使用30分钟间隔
  const interval = 1800 // 30分钟
  const ticks: Array<{ time: number; position: number }> = []
  for (let t = 0; t <= total; t += interval) {
    ticks.push({ time: t, position: t })
  }
  if (ticks.length > 0 && ticks[ticks.length - 1].time < total) {
    ticks.push({ time: total, position: total })
  }
  return ticks
})

const minorTicks = computed(() => {
  const total = getTotalDuration()
  // 始终使用6分钟间隔（30分钟的1/5）
  const minorInterval = 360 // 6分钟
  const ticks: Array<{ time: number; position: number }> = []
  for (let t = 0; t <= total; t += minorInterval) {
    const isMajorTick = timelineTicks.value.some(mt => mt.time === t)
    if (!isMajorTick) {
      ticks.push({ time: t, position: t })
    }
  }
  return ticks
})

function jumpToStart() {
  emit('update:currentTime', 0)
}

function jumpToEnd() {
  emit('update:currentTime', props.duration)
}

function startDragging(type: 'start' | 'end', event: MouseEvent) {
  if (isDragging.value) return // 防止重复触发
  isDragging.value = true
  dragType.value = type
  emit('draggingChange', true) // 通知父组件开始拖动
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDocumentMouseUp)
  event.preventDefault()
  event.stopPropagation()
}

function onDocumentMouseUp(event: MouseEvent) {
  // 只有在拖动状态下才处理停止
  if (isDragging.value) {
    stopDragging()
  }
  event.preventDefault()
  event.stopPropagation()
}

function stopDragging() {
  if (!isDragging.value) return // 已经在停止状态
  isDragging.value = false
  dragType.value = null
  emit('draggingChange', false) // 通知父组件停止拖动
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDocumentMouseUp)
}

function onDragMove(event: MouseEvent) {
  if (!isDragging.value || !timelineScrollRef.value || !timelineContentRef.value || !props.selectedVideo) return

  // 拖动时不触发播放头更新和预览
  event.stopPropagation()
  event.preventDefault()

  const rect = timelineContentRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left + timelineScrollRef.value.scrollLeft
  const time = Math.max(0, Math.min(props.duration, x / basePixelsPerSecond.value))

  if (dragType.value === 'start') {
    emit('update:selectedStartTime', Math.min(time, props.selectedEndTime - 0.1))
  } else if (dragType.value === 'end') {
    emit('update:selectedEndTime', Math.max(time, props.selectedStartTime + 0.1))
  }
}

function onTimelineClick(event: MouseEvent) {
  // 如果正在拖动开始/结束轴，不触发播放头更新
  if (isDragging.value) return

  if (!timelineScrollRef.value || !timelineContentRef.value || !props.selectedVideo) return

  const rect = timelineContentRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left + timelineScrollRef.value.scrollLeft
  const time = Math.max(0, Math.min(props.duration, x / basePixelsPerSecond.value))

  emit('update:currentTime', time)
}

function onTimelineMouseMove(event: MouseEvent) {
  // 如果正在拖动开始/结束轴，不触发预览
  if (isDragging.value) return

  if (!timelineScrollRef.value || !timelineContentRef.value || !props.selectedVideo) return

  const rect = timelineContentRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left + timelineScrollRef.value.scrollLeft
  const time = Math.max(0, Math.min(props.duration, x / basePixelsPerSecond.value))

  hoverPreview.value.time = time
  hoverPreview.value.show = true

  emit('previewTime', time)
}

function onTimelineMouseLeave() {
  hoverPreview.value.show = false
  emit('stopPreview')
}

function onScroll() {
  if (timelineScrollRef.value) {
    scrollLeft.value = timelineScrollRef.value.scrollLeft
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

// Parse time string to seconds
function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(p => parseFloat(p) || 0)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return parseFloat(timeStr) || 0
}

function onStartTimeInput(event: Event) {
  const input = event.target as HTMLInputElement
  const time = parseTime(input.value)
  if (props.selectedVideo && time >= 0 && time < props.duration) {
    emit('update:selectedStartTime', Math.min(time, props.selectedEndTime - 0.1))
  }
}

function onEndTimeInput(event: Event) {
  const input = event.target as HTMLInputElement
  const time = parseTime(input.value)
  if (props.selectedVideo && time > 0 && time <= props.duration) {
    emit('update:selectedEndTime', Math.max(time, props.selectedStartTime + 0.1))
  }
}

onBeforeUnmount(() => {
  stopDragging()
})
</script>

<style scoped>
::-webkit-scrollbar {
  width: 6px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.bg-slate-850 {
  background-color: #0f172a;
}

.z-25 {
  z-index: 25;
}
</style>
