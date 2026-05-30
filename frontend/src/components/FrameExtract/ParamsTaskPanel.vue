<template>
  <aside class="w-80 bg-slate-850 border-l border-slate-700 flex flex-col">
    <div class="flex border-b border-slate-700">
      <button
        @click="activeTab = 'params'"
        :class="[
          'flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200',
          activeTab === 'params'
            ? 'bg-slate-800 text-white border-b-2 border-blue-500'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
        ]"
      >
        参数配置
      </button>
      <button
        @click="activeTab = 'tasks'"
        :class="[
          'flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 relative',
          activeTab === 'tasks'
            ? 'bg-slate-800 text-white border-b-2 border-blue-500'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
        ]"
      >
        任务列表
        <span
          v-if="tasks.length > 0"
          class="absolute top-2 right-3 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
        >
          {{ tasks.length }}
        </span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- 参数配置 -->
      <div v-if="activeTab === 'params'">
        <div v-if="selectedVideo">
          <div class="space-y-5">
            <!-- 输出格式 -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">输出格式</label>
              <select
                v-model="extractConfig.format"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
              </select>
            </div>

            <!-- 图片质量 -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">图片质量</label>
              <input
                v-model.number="extractConfig.quality"
                type="range"
                min="1"
                max="100"
                class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div class="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span class="font-mono">{{ extractConfig.quality }}%</span>
                <span>100</span>
              </div>
            </div>

            <!-- 提取模式 -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">提取模式</label>
              <select
                v-model="extractConfig.mode"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="interval">按时间间隔</option>
                <option value="count">按固定数量</option>
                <option value="keyframes">关键帧</option>
              </select>
            </div>

            <!-- 间隔/数量 -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">
                {{ extractConfig.mode === 'interval' ? '间隔 (秒)' : extractConfig.mode === 'count' ? '提取数量' : '敏感度' }}
              </label>
              <input
                v-model.number="extractConfig.intervalOrCount"
                type="number"
                :min="extractConfig.mode === 'interval' ? 0.1 : 1"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <!-- 输出目录 -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">输出目录</label>
              <input
                v-model="extractConfig.outputDir"
                type="text"
                placeholder="默认: 视频同目录/frames"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <!-- 选择范围信息 -->
            <div class="p-3 bg-slate-800 rounded-lg border border-slate-700">
              <h3 class="text-xs font-medium text-slate-300 mb-2">已选范围</h3>
              <div class="text-xs text-slate-500 space-y-1.5">
                <div class="flex justify-between">
                  <span>开始</span>
                  <span class="text-emerald-400 font-mono">{{ formatTime(selectedStartTime) }}</span>
                </div>
                <div class="flex justify-between">
                  <span>结束</span>
                  <span class="text-rose-400 font-mono">{{ formatTime(selectedEndTime) }}</span>
                </div>
                <div class="flex justify-between pt-1 border-t border-slate-700 mt-1">
                  <span>时长</span>
                  <span class="text-white font-mono">{{ formatDuration(selectedEndTime - selectedStartTime) }}</span>
                </div>
                <div v-if="extractConfig.mode === 'interval'" class="flex justify-between">
                  <span>预计</span>
                  <span class="text-blue-400">{{ Math.floor((selectedEndTime - selectedStartTime) / extractConfig.intervalOrCount) + 1 }} 帧</span>
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div>
              <button
                @click="extractFromSelection"
                class="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg shadow-emerald-900/30"
              >
                🖼️ 提取选中范围
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-slate-500 text-center mt-12">
          请从左侧选择视频
        </div>
      </div>

      <!-- 任务列表 -->
      <div v-else>
        <div v-if="tasks.length === 0" class="text-slate-500 text-center mt-12">
          暂无任务
        </div>
        <div v-else class="space-y-3">
          <ExtractTaskItem
            v-for="task in tasks"
            :key="task.id"
            :task="task"
            @remove="removeTask(task.id)"
            @openDir="openOutputDir(task)"
          />
        </div>
        <button
          v-if="hasCompletedTasks"
          @click="clearCompletedTasks"
          class="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-sm font-medium transition-all duration-200 border border-slate-700"
        >
          清除已完成任务
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ExtractTaskItem from './ExtractTaskItem.vue'
import type { Video, FrameExtractStatus } from '@/types'

interface Props {
  selectedVideo: Video | null
  selectedStartTime: number
  selectedEndTime: number
  currentTime: number
  tasks: FrameExtractStatus[]
}

const props = defineProps<Props>()

interface Emits {
  (e: 'extractSelection'): void
  (e: 'extractCurrent'): void
  (e: 'removeTask', id: string): void
  (e: 'clearCompleted'): void
  (e: 'openDir', task: FrameExtractStatus): void
  (e: 'updateConfig', config: ExtractConfig): void
}

const emit = defineEmits<Emits>()

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

const activeTab = ref<'params' | 'tasks'>('params')

const hasCompletedTasks = computed(() => {
  return props.tasks.some(t => t.status === 'completed' || t.status === 'error')
})

watch(extractConfig, (newConfig) => {
  emit('updateConfig', { ...newConfig })
}, { deep: true })

function extractFromSelection() {
  emit('extractSelection')
  activeTab.value = 'tasks'
}

function extractFromCurrentTime() {
  emit('extractCurrent')
  activeTab.value = 'tasks'
}

function removeTask(id: string) {
  emit('removeTask', id)
}

function clearCompletedTasks() {
  emit('clearCompleted')
}

function openOutputDir(task: FrameExtractStatus) {
  emit('openDir', task)
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}小时${m}分`
}
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

.bg-slate-800 {
  background-color: #1e293b;
}
</style>
