<template>
  <div>
    <!-- 导航栏图标 -->
    <button
      v-if="hasAnyStatus"
      @click="visible = !visible"
      class="fixed top-4 right-4 z-50 w-12 h-12 bg-slate-800 border border-slate-700 rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-700 transition-colors"
    >
      <div v-if="hasInProgress" class="relative">
        <div class="w-8 h-8 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
        <div class="absolute inset-0 flex items-center justify-center text-sm">
          🗂️
        </div>
      </div>
      <div v-else class="text-2xl">
        ✅
      </div>
      <!-- 数量徽章 -->
      <div v-if="inProgressCount > 0" class="absolute -bottom-1 -right-1 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg">
        {{ inProgressCount }}
      </div>
    </button>

    <!-- 展开的进度列表 -->
    <div
      v-if="visible && hasAnyStatus"
      class="fixed top-4 right-20 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 min-w-[350px] max-h-[500px] overflow-y-auto"
    >
      <div class="flex items-center justify-between gap-2 mb-3">
        <h3 class="text-sm font-bold text-white">
          雪碧图生成 ({{ allStatuses.length }})
        </h3>
        <button
          @click="visible = false"
          class="text-slate-500 hover:text-slate-300 transition-colors"
        >
          ×
        </button>
      </div>

      <!-- 每个视频的进度 -->
      <div class="space-y-3">
        <div
          v-for="status in sortedStatuses"
          :key="status.videoPath"
          class="bg-slate-700/50 rounded-lg p-3"
        >
          <div class="flex items-start gap-3">
            <!-- 图标 -->
            <div class="flex-shrink-0 mt-0.5">
              <div v-if="isInProgress(status)" class="relative">
                <div class="w-8 h-8 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
              </div>
              <div v-else-if="status.error" class="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <span class="text-lg">❌</span>
              </div>
              <div v-else class="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <span class="text-lg">✅</span>
              </div>
            </div>

            <!-- 内容 -->
            <div class="flex-1 min-w-0">
              <!-- 视频标题 - 可点击跳转 -->
              <p
                v-if="status.videoTitle"
                @click="navigateToVideo(status.videoPath)"
                class="text-sm text-teal-400 hover:text-teal-300 truncate cursor-pointer hover:underline"
                title="点击跳转到视频"
              >
                {{ status.videoTitle }}
              </p>

              <!-- 消息 -->
              <p v-if="status.message" class="text-xs text-slate-400 mt-1">
                {{ status.message }}
              </p>

              <!-- 进度条 -->
              <div v-if="isInProgress(status)" class="mt-2">
                <div class="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                  <div
                    class="bg-teal-500 h-full rounded-full transition-all duration-300"
                    :style="{ width: getProgressPercent(status) + '%' }"
                  ></div>
                </div>
                <div class="flex justify-between mt-1 text-xs text-slate-400">
                  <span>{{ getProgressPercent(status) }}%</span>
                  <span v-if="status.frameCount != null && status.totalFrames != null">
                    {{ status.frameCount }} / {{ status.totalFrames }} 帧
                  </span>
                </div>
              </div>

              <!-- 完成提示 -->
              <div v-else-if="!status.error" class="mt-1">
                <span class="text-green-400 text-xs">已完成</span>
              </div>

              <!-- 错误提示 -->
              <div v-else class="mt-1">
                <span class="text-red-400 text-xs">{{ status.errorMessage || '生成失败' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import { useRouter } from 'vue-router'
import type { SpriteStatus } from '@/types'

const store = useVideoStore()
const router = useRouter()
const visible = ref(false)

// 获取所有状态
const allStatuses = computed(() => {
  return Array.from(store.spriteStatusMap.values())
})

// 按时间排序，最新的在前
const sortedStatuses = computed(() => {
  return [...allStatuses.value].sort((a, b) => {
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
})

const hasAnyStatus = computed(() => allStatuses.value.length > 0)
const inProgressCount = computed(() => store.spriteInProgressSet.size)
const hasInProgress = computed(() => store.spriteInProgress)

function isInProgress(status: SpriteStatus): boolean {
  return status.percent != null && status.percent < 100 && !status.error
}

function getProgressPercent(status: SpriteStatus): number {
  return Math.min(100, Math.max(0, Math.floor(status.percent || 0)))
}

function navigateToVideo(videoPath: string | undefined) {
  if (!videoPath) return

  // 找到对应的视频
  const video = store.videos.find(v => {
    const normalize = (p: string) => p.replace(/\\/g, '/')
    return normalize(v.videoPath) === normalize(videoPath)
  })

  if (video) {
    store.addToRecent(video.id)
    router.push({ name: 'video', params: { id: video.id } })
    visible.value = false
  }
}

// 当开始生成时自动显示
watch(() => store.spriteInProgress, (inProgress) => {
  if (inProgress) {
    visible.value = true
  }
})
</script>
