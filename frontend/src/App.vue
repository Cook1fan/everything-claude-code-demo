<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <div v-if="initError" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="text-6xl mb-4">⚠️</div>
        <h2 class="text-xl font-semibold text-white mb-2">连接失败</h2>
        <p class="text-slate-400 mb-4">{{ initError }}</p>
        <button
          @click="retryInit"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          重试
        </button>
      </div>
    </div>
    <div v-else-if="!storesInitialized" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-10 h-10 border-3 border-slate-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-slate-400">加载中...</p>
      </div>
    </div>
    <div v-else>
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import { useVideoStore } from '@/stores/videoStore'

const playHistory = usePlayHistoryStore()
const videoStore = useVideoStore()
const storesInitialized = ref(false)
const initError = ref<string | null>(null)

let pollTimer: number | null = null

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(() => {
    // 仅在页面可见时轮询
    if (document.visibilityState === 'visible') {
      videoStore.getScanStatus()
    }
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 页面可见性变化时处理轮询
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    videoStore.getScanStatus()
    startPolling()
  } else {
    stopPolling()
  }
}

async function doInit() {
  initError.value = null
  try {
    await playHistory.initialize()
    await videoStore.initialize()
    await videoStore.loadVideos()
    await videoStore.getScanStatus()
    storesInitialized.value = true
    startPolling()
  } catch (err) {
    initError.value = err instanceof Error ? err.message : '初始化失败，请检查后端服务是否启动'
  }
}

function retryInit() {
  doInit()
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  doInit()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopPolling()
})
</script>

<style scoped>
</style>
