<template>
  <header class="bg-slate-800 border-b border-slate-700 px-6 py-4 shrink-0">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <!-- Logo 和首页链接 -->
        <router-link
          to="/"
          class="flex items-center gap-2 text-xl font-bold text-white hover:text-blue-400 transition-colors"
        >
          🎬 视频浏览器
        </router-link>

        <!-- 导航菜单 -->
        <nav class="flex items-center gap-2">
          <router-link
            to="/"
            :class="[
              'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
              isActiveRoute('/') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            ]"
          >
            🏠 首页
          </router-link>
          <router-link
            to="/history"
            :class="[
              'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
              isActiveRoute('/history') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            ]"
          >
            📊 播放历史
          </router-link>

          <!-- 雪碧图进度指示器 -->
          <div class="sprite-progress-wrapper relative flex items-center gap-2 ml-2">
            <button
              @mousedown.stop="showSpritePanel = !showSpritePanel"
              class="relative flex items-center gap-3 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-600/80 rounded-xl transition-all duration-200 border border-slate-600/50 hover:border-slate-500/50"
            >
              <div v-if="store.spriteInProgressSet.size > 0" class="relative flex items-center gap-2">
                <div class="w-5 h-5 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin"></div>
                <span class="min-w-[24px] h-6 flex items-center justify-center text-xs bg-gradient-to-r from-teal-500 to-emerald-500 rounded-lg text-white font-bold shadow-lg">
                  {{ store.spriteInProgressSet.size }}
                </span>
              </div>
              <div v-else class="relative flex items-center gap-2">
                <div class="w-5 h-5 rounded-full border-2 border-slate-500/30 flex items-center justify-center">
                  <div class="w-2 h-2 rounded-full bg-slate-500/50"></div>
                </div>
                <span class="min-w-[24px] h-6 flex items-center justify-center text-xs bg-slate-600/50 rounded-lg text-slate-400 font-bold">
                  0
                </span>
              </div>
              <span v-if="store.spriteInProgressSet.size > 0" class="text-sm font-medium text-slate-200">
                生成中
              </span>
            </button>

            <!-- 展开的进度面板 -->
            <div
              v-show="showSpritePanel"
              class="absolute top-full left-0 mt-2 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 min-w-[350px] max-h-[500px] overflow-y-auto"
              @mousedown.stop
            >
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-white">
                    雪碧图生成 ({{ allSpriteStatus.length }})
                  </h3>
                  <button
                    v-if="allSpriteStatus.length > 0"
                    @mousedown.stop="clearAllTasks"
                    class="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded transition-colors"
                  >
                    清除
                  </button>
                </div>
                <button
                  @mousedown.stop="showSpritePanel = false"
                  class="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ×
                </button>
              </div>

              <!-- 每个视频的进度 -->
              <div v-for="status in allSpriteStatus" :key="status.videoPath || status.videoId" class="mb-3 pb-3 border-b border-slate-700 last:border-0 last:mb-0 last:pb-0">
                <div class="flex items-start gap-2">
                  <span v-if="status.percent === 100" class="text-green-400 text-sm shrink-0">✓</span>
                  <div class="flex-1 min-w-0">
                    <p
                      v-if="status.videoId"
                      class="text-sm text-teal-400 hover:text-teal-300 truncate mb-1 cursor-pointer hover:underline"
                      :title="status.videoTitle || status.videoPath"
                      @mousedown.stop="navigateToVideo(status)"
                    >
                      {{ status.videoTitle || getVideoName(status.videoPath) }}
                    </p>
                    <p
                      v-else
                      class="text-sm text-slate-400 truncate mb-1"
                      :title="status.videoTitle || status.videoPath"
                    >
                      {{ status.videoTitle || getVideoName(status.videoPath) }}
                    </p>
                    <p v-if="status.message && status.percent !== 100" class="text-xs text-slate-400 mb-2">
                      {{ status.message }}
                    </p>
                  </div>
                </div>

                <!-- 倒计时显示（仅对刚完成的） -->
                <div v-if="shouldShowCountdown(status)" class="mb-3">
                  <div class="flex items-center justify-center gap-2">
                    <div class="text-3xl font-bold text-teal-400 font-mono">
                      {{ getCountdownForVideo(status.videoPath) }}
                    </div>
                    <div class="text-slate-400 text-sm">秒后刷新</div>
                  </div>
                </div>

                <!-- 进度条 -->
                <div v-else-if="status.percent != null && status.percent < 100" class="mb-2">
                  <div class="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      class="bg-teal-500 h-full rounded-full transition-all duration-300"
                      :style="{ width: Math.min(100, Math.max(0, status.percent)) + '%' }"
                    ></div>
                  </div>
                  <div class="flex justify-between mt-1 text-xs text-slate-400">
                    <span>{{ Math.min(100, Math.max(0, status.percent || 0)) }}%</span>
                    <span v-if="status.frameCount">
                      {{ status.frameCount }} / {{ status.totalFrames }} 帧
                    </span>
                  </div>
                </div>


                <!-- 错误提示 -->
                <div v-else-if="status.error" class="flex items-center gap-2">
                  <span class="text-red-400 text-sm">✗ {{ status.message || '失败' }}</span>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div class="flex items-center gap-4">
        <!-- 扫描状态 -->
        <div v-if="store.scanning" class="flex items-center gap-2 text-yellow-400">
          <div class="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span>正在扫描...</span>
        </div>
        <div v-else class="text-sm text-slate-400">
          {{ store.videoCount }} 个视频
          <span v-if="store.lastScan" class="ml-2">
            (最后扫描: {{ formatTime(store.lastScan) }})
          </span>
        </div>
        <button
          @click="handleScan"
          :disabled="store.scanning"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          🔄 重新扫描
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVideoStore } from '@/stores/videoStore'
const store = useVideoStore()
const route = useRoute()
const router = useRouter()
const showSpritePanel = ref(false)

// 用非响应式对象存储倒计时，避免组件重渲染
const countdownTimers = markRaw(new Map<string, number>())
const countdownSecondsMap = markRaw(new Map<string, number>())
const countdownUpdateTriggers = ref<Map<string, number>>(new Map()) // 只用来触发更新

let wasInProgressMap = markRaw(new Map<string, boolean>())
const COUNTDOWN_SECONDS = 3

// 获取所有雪碧图状态，最新的在上面，最老的在下面
const allSpriteStatus = computed(() => {
  const statusArray = Array.from(store.spriteStatusMap.values())
  // 按 createdAt 倒序排列，最新的在前（任务开始时间）
  return statusArray.sort((a, b) => {
    const timeA = a.createdAt || 0
    const timeB = b.createdAt || 0
    return timeB - timeA
  })
})

// 点击外部关闭面板
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.sprite-progress-wrapper')) {
    showSpritePanel.value = false
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleClickOutside)
  countdownTimers.forEach((timer) => clearInterval(timer))
  countdownTimers.clear()
})

function isActiveRoute(path: string): boolean {
  return route.path === path
}

async function handleScan() {
  await store.startScan()
  setTimeout(async () => {
    await store.loadVideos()
  }, 3000)
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

function getVideoName(videoPath?: string) {
  if (!videoPath) return ''
  const parts = videoPath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || videoPath
}

function navigateToVideo(status: { videoId?: string; videoPath?: string }) {
  if (!status.videoId) return

  // 清除倒计时
  if (status.videoPath && countdownTimers.has(status.videoPath)) {
    clearInterval(countdownTimers.get(status.videoPath)!)
    countdownTimers.delete(status.videoPath)
  }
  if (status.videoPath) {
    countdownSecondsMap.delete(status.videoPath)
    countdownUpdateTriggers.value.delete(status.videoPath)
  }

  // 关闭面板
  showSpritePanel.value = false

  // 添加到最近播放
  store.addToRecent(status.videoId)

  // 导航到视频页
  router.push('/video/' + status.videoId)
}

function shouldShowCountdown(status: { videoPath?: string; percent?: number }): boolean {
  if (!status.videoPath) return false
  return status.percent === 100 && countdownSecondsMap.has(status.videoPath) && countdownSecondsMap.get(status.videoPath)! > 0
}

function getCountdownForVideo(videoPath?: string): number {
  if (!videoPath) return 0
  // 访问一下 trigger，确保响应式更新
  countdownUpdateTriggers.value.get(videoPath)
  return countdownSecondsMap.get(videoPath) || 0
}

function clearAllTasks() {
  store.clearAllSpriteTasks()
}

// 当开始生成时自动显示面板，处理倒计时
watch(() => allSpriteStatus.value, (newStatuses) => {
  for (const status of newStatuses) {
    if (!status.videoPath) continue

    const isInProgress = status.percent != null && status.percent < 100 && !status.error
    const wasInProgress = wasInProgressMap.get(status.videoPath) || false

    // 清除倒计时
    if (isInProgress) {
      if (countdownTimers.has(status.videoPath)) {
        clearInterval(countdownTimers.get(status.videoPath)!)
        countdownTimers.delete(status.videoPath)
      }
      countdownSecondsMap.set(status.videoPath, 0)
      countdownUpdateTriggers.value.delete(status.videoPath)
    }

    // 检测从进行中变为完成
    if (wasInProgress && !isInProgress && status.percent === 100) {
      // 开始倒计时刷新
      countdownSecondsMap.set(status.videoPath, COUNTDOWN_SECONDS)
      countdownUpdateTriggers.value.set(status.videoPath, Date.now())

      const vp = status.videoPath
      const timer = window.setInterval(() => {
        const current = countdownSecondsMap.get(vp) || 0
        if (current <= 1) {
          clearInterval(timer)
          countdownTimers.delete(vp)
          countdownSecondsMap.delete(vp)
          countdownUpdateTriggers.value.delete(vp)
          location.reload()
        } else {
          countdownSecondsMap.set(vp, current - 1)
          countdownUpdateTriggers.value.set(vp, Date.now())
        }
      }, 1000)

      countdownTimers.set(vp, timer)
    }

    wasInProgressMap.set(status.videoPath, isInProgress)
  }
}, { deep: true })
</script>
