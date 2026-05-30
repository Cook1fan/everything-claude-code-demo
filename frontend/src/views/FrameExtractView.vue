<template>
  <AppLayout>
    <div class="flex flex-col h-full bg-slate-900">
      <!-- 上层：三栏布局 -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 左栏：视频列表 -->
        <VideoListPanel
          :selected-video="selectedVideo"
          :videos="displayVideos"
          @select="selectVideo"
          @remove="removeVideoFromList"
        />

        <!-- 中栏：视频播放 -->
        <VideoPlayerPanel
          ref="videoPlayerRef"
          :selected-video="selectedVideo"
          :selected-start-time="selectedStartTime"
          :selected-end-time="selectedEndTime"
          :is-dragging="isTimelineDragging"
          @time-update="onTimeUpdateFromPlayer"
          @duration-change="duration = $event"
        />

        <!-- 右栏：参数和任务 -->
        <ParamsTaskPanel
          :selected-video="selectedVideo"
          :selected-start-time="selectedStartTime"
          :selected-end-time="selectedEndTime"
          :current-time="currentTime"
          :tasks="extractTasks"
          @extract-selection="extractFromSelection"
          @extract-current="extractFromCurrentTime"
          @remove-task="removeTask"
          @clear-completed="clearCompletedTasks"
          @open-dir="openOutputDir"
          @update-config="extractConfig = $event"
        />
      </div>

      <!-- 下层：时间轴区域 -->
      <TimelineArea
        :selected-video="selectedVideo"
        :duration="duration"
        :current-time="currentTime"
        :selected-start-time="selectedStartTime"
        :selected-end-time="selectedEndTime"
        :is-dragging="isTimelineDragging"
        @update:current-time="onCurrentTimeUpdate"
        @update:selected-start-time="selectedStartTime = $event"
        @update:selected-end-time="selectedEndTime = $event"
        @preview-time="onPreviewTime"
        @stop-preview="onStopPreview"
        @dragging-change="isTimelineDragging = $event"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useVideoStore } from '@/stores/videoStore'
import { useFrameExtractStore } from '@/stores/frameExtractStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import AppLayout from '@/components/AppLayout.vue'
import VideoListPanel from '@/components/FrameExtract/VideoListPanel.vue'
import VideoPlayerPanel from '@/components/FrameExtract/VideoPlayerPanel.vue'
import ParamsTaskPanel from '@/components/FrameExtract/ParamsTaskPanel.vue'
import TimelineArea from '@/components/FrameExtract/TimelineArea.vue'
import type { Video, FrameExtractStatus } from '@/types'

const store = useVideoStore()
const frameStore = useFrameExtractStore()
const playHistoryStore = usePlayHistoryStore()
const route = useRoute()

const videoPlayerRef = ref<InstanceType<typeof VideoPlayerPanel> | null>(null)
const selectedVideo = ref<Video | null>(null)
const currentTime = ref(0)
const duration = ref(1800)
const selectedStartTime = ref(0)
const selectedEndTime = ref(0)
const isHoveringTimeline = ref(false)
const isTimelineDragging = ref(false) // 时间轴拖动状态
const lastPlayheadTime = ref(0)
const displayVideos = ref<Video[]>([])

// 从 localStorage 加载视频列表
function loadVideoList() {
  try {
    const saved = localStorage.getItem('frameExtractVideoList')
    if (saved) {
      const ids = JSON.parse(saved) as string[]
      displayVideos.value = ids
        .map(id => store.videos.find(v => v.id === id))
        .filter((v): v is Video => v !== undefined)
    }
  } catch (e) {
    console.error('加载视频列表失败:', e)
  }
}

// 保存视频列表到 localStorage
function saveVideoList() {
  const ids = displayVideos.value.map(v => v.id)
  localStorage.setItem('frameExtractVideoList', JSON.stringify(ids))
}

// 保存任务列表到 localStorage
function saveTasks() {
  const tasksData = extractTasks.value.map(t => ({
    id: t.id,
    videoPath: t.videoPath,
    videoId: t.videoId,
    videoTitle: t.videoTitle,
    status: t.status,
    stage: t.stage,
    message: t.message,
    percent: t.percent,
    totalFrames: t.totalFrames,
    extractedFrames: t.extractedFrames,
    error: t.error,
    errorMessage: t.errorMessage,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    outputPath: t.outputPath,
    outputFileName: t.outputFileName,
    frameCount: t.frameCount,
    totalTime: t.totalTime
  }))
  localStorage.setItem('frameExtractTasks', JSON.stringify(tasksData))
}

// 加载任务列表从 localStorage
function loadTasks() {
  try {
    const saved = localStorage.getItem('frameExtractTasks')
    if (saved) {
      const tasksData = JSON.parse(saved) as FrameExtractStatus[]
      // 只加载最近的任务（保留最后20条）
      extractTasks.value = tasksData.slice(-20)
    }
  } catch (e) {
    console.error('加载任务列表失败:', e)
  }
}

// 添加视频到列表（如果不存在）
function addVideoToList(video: Video) {
  if (!displayVideos.value.find(v => v.id === video.id)) {
    displayVideos.value.push(video)
    saveVideoList()
  }
}

// 从列表中删除视频
function removeVideoFromList(videoId: string) {
  const index = displayVideos.value.findIndex(v => v.id === videoId)
  if (index !== -1) {
    displayVideos.value.splice(index, 1)
    saveVideoList()
    // 如果删除的是当前选中的视频，清空选中
    if (selectedVideo.value?.id === videoId) {
      selectedVideo.value = null
    }
  }
}

interface ExtractConfig {
  format: 'jpg' | 'png' | 'webp'
  quality: number
  mode: 'interval' | 'count' | 'keyframes'
  intervalOrCount: number
  outputDir: string
}

const extractConfig = ref<ExtractConfig>({
  format: 'jpg',
  quality: 100,
  mode: 'interval',
  intervalOrCount: 5,
  outputDir: 'C:\\Downloads'
})

const extractTasks = ref<FrameExtractStatus[]>([])

function selectVideo(video: Video) {
  selectedVideo.value = video
  currentTime.value = 0
  // 优先从播放历史中获取已保存的时长，其次用 video.duration
  const savedDuration = playHistoryStore.getVideoDuration(video.id)
  duration.value = savedDuration || video.duration || 0
  selectedStartTime.value = 0
  selectedEndTime.value = duration.value
  nextTick(() => {
    videoPlayerRef.value?.setCurrentTime(0)
  })
}

function onCurrentTimeUpdate(time: number) {
  // 拖动时间轴时不更新播放头
  if (isTimelineDragging.value) return
  currentTime.value = time
  lastPlayheadTime.value = time
  videoPlayerRef.value?.setCurrentTime(time)
}

function onTimeUpdateFromPlayer(time: number) {
  // 拖动时间轴时不处理来自播放器的timeupdate事件
  if (isTimelineDragging.value) return
  currentTime.value = time
  lastPlayheadTime.value = time
}

function onPreviewTime(time: number) {
  // 只有在非预览状态下，才保存当前的播放时间（用于预览结束后恢复）
  if (!isHoveringTimeline.value) {
    // 保存当前的播放时间，这样预览结束后可以恢复
    lastPlayheadTime.value = currentTime.value
  }
  isHoveringTimeline.value = true
  videoPlayerRef.value?.startPreview()
  if (videoPlayerRef.value?.videoRef) {
    videoPlayerRef.value.videoRef.pause()
    videoPlayerRef.value.setCurrentTime(time)
  }
}

function onStopPreview() {
  isHoveringTimeline.value = false
  if (videoPlayerRef.value?.videoRef) {
    videoPlayerRef.value.setCurrentTime(lastPlayheadTime.value)
  }
  videoPlayerRef.value?.stopPreview()
}

async function extractFromSelection() {
  if (!selectedVideo.value) return

  const result = await frameStore.startTask(selectedVideo.value.videoPath, {
    startTime: selectedStartTime.value,
    endTime: selectedEndTime.value,
    interval: extractConfig.value.intervalOrCount,
    quality: Math.max(1, Math.min(31, Math.round(32 - (extractConfig.value.quality / 100) * 31))),
    outputWidth: -1,
    outputHeight: -1,
    format: extractConfig.value.format,
    outputDir: extractConfig.value.outputDir,
  })

  if (result.success && result.taskId) {
    await nextTick()
    const newTask = frameStore.getTask(result.taskId)
    if (newTask) {
      extractTasks.value.push(newTask)
      saveTasks()
    }
  }
}

async function extractFromCurrentTime() {
  if (!selectedVideo.value) return

  const result = await frameStore.startTask(selectedVideo.value.videoPath, {
    startTime: currentTime.value,
    endTime: currentTime.value,
    interval: 1,
    quality: Math.max(1, Math.min(31, Math.round(32 - (extractConfig.value.quality / 100) * 31))),
    outputWidth: -1,
    outputHeight: -1,
    format: extractConfig.value.format,
    outputDir: extractConfig.value.outputDir,
  })

  if (result.success && result.taskId) {
    await nextTick()
    const newTask = frameStore.getTask(result.taskId)
    if (newTask) {
      extractTasks.value.push(newTask)
      saveTasks()
    }
  }
}

function removeTask(id: string) {
  const index = extractTasks.value.findIndex(t => t.id === id)
  if (index !== -1) {
    extractTasks.value.splice(index, 1)
    saveTasks()
  }
}

function clearCompletedTasks() {
  extractTasks.value = extractTasks.value.filter(t => t.status === 'pending' || t.status === 'running')
  saveTasks()
}

function openOutputDir(task: FrameExtractStatus) {
  if (task.outputPath) {
    fetch('/api/open-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: task.outputPath }),
    })
  }
}

onMounted(async () => {
  await store.loadVideos()
  await playHistoryStore.initialize()
  frameStore.initialize()

  // 先从本地加载列表和任务
  loadVideoList()
  loadTasks()

  // 从视频页进入时，添加该视频到列表并选中
  const videoId = route.query.videoId as string
  const fromVideoPage = route.query.from === 'video'
  if (videoId && fromVideoPage) {
    const video = store.videos.find(v => v.id === videoId)
    if (video) {
      addVideoToList(video)
      selectVideo(video)
    }
  }
})

onBeforeUnmount(() => {
  frameStore.cleanup()
})

// 监听任务更新
watch(() => frameStore.allTasks, (newTasks) => {
  let hasUpdates = false
  for (const task of newTasks) {
    const existing = extractTasks.value.find(t => t.id === task.id)
    if (existing) {
      const wasUpdated = JSON.stringify(existing) !== JSON.stringify(task)
      Object.assign(existing, task)
      if (wasUpdated) hasUpdates = true
    }
  }
  if (hasUpdates) {
    saveTasks()
  }
}, { deep: true })
</script>

<style scoped>
.bg-slate-900 {
  background-color: #0f172a;
}
</style>
