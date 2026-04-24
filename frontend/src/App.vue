<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <div v-if="!storesInitialized" class="flex items-center justify-center min-h-screen">
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
import { onMounted, ref } from 'vue'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import { useVideoStore } from '@/stores/videoStore'

const playHistory = usePlayHistoryStore()
const videoStore = useVideoStore()
const storesInitialized = ref(false)

onMounted(async () => {
  await playHistory.initialize()
  await videoStore.initialize()
  await videoStore.loadVideos()
  await videoStore.getScanStatus()

  // 定期更新扫描状态
  setInterval(() => {
    videoStore.getScanStatus()
  }, 2000)

  storesInitialized.value = true
})
</script>

<style scoped>
</style>
