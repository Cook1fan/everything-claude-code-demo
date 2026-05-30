<template>
  <div class="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-all duration-200">
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1 min-w-0">
        <div class="font-medium text-slate-200 truncate">{{ task.videoTitle }}</div>
        <div class="text-xs text-slate-500 mt-1">{{ formatTaskTimestamp(task.createdAt) }}</div>
      </div>
      <span
        :class="[
          'px-2.5 py-1 text-xs font-medium rounded-full',
          task.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
          task.status === 'running' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
          task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          'bg-red-500/10 text-red-400 border border-red-500/20'
        ]"
      >
        {{ getTaskStatusLabel(task.status) }}
      </span>
    </div>

    <div v-if="task.status === 'running' && task.percent !== undefined" class="mb-3">
      <div class="flex justify-between text-xs text-slate-500 mb-1.5">
        <span>{{ task.extractedFrames || 0 }} / {{ task.totalFrames || 0 }}</span>
        <span class="font-mono">{{ Math.round(task.percent) }}%</span>
      </div>
      <div class="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
          :style="{ width: task.percent + '%' }"
        ></div>
      </div>
    </div>

    <div v-if="task.status === 'completed'" class="flex items-center justify-between pt-2 border-t border-slate-700">
      <span class="text-xs text-emerald-400">
        ✓ 成功提取 {{ task.extractedFrames || 0 }} 帧
      </span>
      <button
        @click="openOutputDir"
        class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        打开目录
      </button>
    </div>

    <div v-if="task.status === 'error'" class="mt-3 p-2.5 bg-red-500/10 rounded border border-red-500/20">
      <p class="text-xs text-red-400">{{ task.errorMessage }}</p>
    </div>

    <div v-if="task.status === 'pending' || task.status === 'error'" class="mt-3 flex justify-end">
      <button
        @click="remove"
        class="text-xs text-slate-500 hover:text-red-400 transition-colors"
      >
        移除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FrameExtractStatus } from '@/types'

interface Props {
  task: FrameExtractStatus
}

defineProps<Props>()

interface Emits {
  (e: 'remove'): void
  (e: 'openDir'): void
}

const emit = defineEmits<Emits>()

function remove() {
  emit('remove')
}

function openOutputDir() {
  emit('openDir')
}

function formatTaskTimestamp(timestamp?: number): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN')
}

function getTaskStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '排队中',
    running: '运行中',
    completed: '已完成',
    error: '错误',
    aborted: '已中止',
  }
  return labels[status] || status
}
</script>

<style scoped>
.bg-slate-80 {
  background-color: #1e293b;
}
</style>
