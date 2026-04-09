<template>
  <div class="flex flex-col h-screen">
    <!-- 顶部导航栏 -->
    <header class="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-white">
            🎬 视频浏览器
          </h1>
          <button
            @click="goToHistory"
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            📊 播放历史
          </button>
        </div>
        <div class="flex items-center gap-4">
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

    <div class="flex flex-1 overflow-hidden">
      <!-- 侧边栏 -->
      <aside class="w-72 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto flex flex-col">
        <!-- 搜索框 -->
        <div class="mb-4">
          <input
            v-model="store.searchQuery"
            type="text"
            placeholder="搜索视频..."
            class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <!-- 全部按钮 -->
        <div class="mb-2">
          <button
            @click="store.selectedDirectory = ''"
            :class="[
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
              !store.selectedDirectory ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            ]"
          >
            <span>🏠</span>
            全部视频
          </button>
        </div>

        <!-- 目录树 -->
        <div class="flex-1 overflow-y-auto">
          <h3 class="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">目录</h3>
          <DirectoryTree
            :nodes="store.directoryTree"
            :selected-path="store.selectedDirectory"
            :expanded-paths="store.expandedNodes"
            @toggle="store.toggleNode"
            @select="store.selectDirectory"
          />
        </div>
      </aside>

      <!-- 主内容区 -->
      <main ref="mainContentRef" class="flex-1 overflow-y-auto p-6 flex flex-col">
        <!-- 面包屑导航和控制栏 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div v-if="store.selectedDirectory" class="flex items-center gap-2 text-sm">
              <button
                @click="store.selectedDirectory = ''"
                class="text-blue-400 hover:text-blue-300"
              >
                全部视频
              </button>
              <span class="text-slate-600">/</span>
              <span class="text-slate-300">{{ getDirectoryName(store.selectedDirectory) }}</span>
            </div>
            <div v-else class="text-slate-400 text-sm">
              全部视频
            </div>
          </div>

          <!-- 排序和分页控制 -->
          <div class="flex items-center gap-3">
            <!-- 排序 -->
            <div class="flex items-center gap-2">
              <span class="text-slate-400 text-sm">排序:</span>
              <select
                :value="store.sortMode"
                @change="(e) => store.setSortMode(e.target.value as any)"
                class="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="default">默认</option>
                <option value="random">随机</option>
                <option value="name">名称</option>
                <option value="date">日期</option>
              </select>
              <button
                v-if="store.sortMode === 'random'"
                @click="store.reshuffle()"
                class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                🔀 换一批
              </button>
            </div>

            <!-- 顶部分页 -->
            <div v-if="store.totalPages > 1" class="flex items-center gap-2">
              <button
                @click="store.prevPage()"
                :disabled="store.currentPage === 1"
                class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
              >
                ← 上一页
              </button>
              <span class="text-slate-400 text-sm">
                {{ store.currentPage }} / {{ store.totalPages }}
              </span>
              <button
                @click="store.nextPage()"
                :disabled="store.currentPage === store.totalPages"
                class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
              >
                下一页 →
              </button>
            </div>
          </div>
        </div>

        <div v-if="store.loading" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-slate-400">加载中...</p>
          </div>
        </div>

        <div v-else-if="store.filteredVideos.length === 0" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-6xl mb-4">🎬</div>
            <h2 class="text-xl font-semibold text-white mb-2">没有找到视频</h2>
            <p class="text-slate-400 mb-4">
              请先在 <code class="bg-slate-700 px-2 py-1 rounded">scanner/config.js</code> 中配置你的硬盘路径
            </p>
            <button
              @click="handleScan"
              :disabled="store.scanning"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg"
            >
              开始扫描
            </button>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col">
          <!-- 视频网格 -->
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <VideoCard
              v-for="video in store.pagedVideos"
              :key="video.id"
              :video="video"
              @click="playVideo(video)"
            />
          </div>

          <!-- 底部分页控件 -->
          <div v-if="store.totalPages > 1" class="mt-6 flex items-center justify-center gap-2">
            <button
              @click="store.prevPage()"
              :disabled="store.currentPage === 1"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              上一页
            </button>
            <span class="text-slate-400 px-4">
              第 {{ store.currentPage }} / {{ store.totalPages }} 页
              <span class="text-slate-500 ml-2">
                (共 {{ store.filteredVideos.length }} 个视频)
              </span>
            </span>
            <button
              @click="store.nextPage()"
              :disabled="store.currentPage === store.totalPages"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      </main>
    </div>

    <!-- 快速滚动按钮 -->
    <div class="fixed bottom-6 right-6 flex flex-col gap-2">
      <button
        @click="scrollToTop"
        class="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-full shadow-lg transition-colors flex items-center justify-center"
        title="到顶部"
      >
        ↑
      </button>
      <button
        @click="scrollToBottom"
        class="w-12 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-full shadow-lg transition-colors flex items-center justify-center"
        title="到底部"
      >
        ↓
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useVideoStore } from '@/stores/videoStore'
import VideoCard from '@/components/VideoCard.vue'
import DirectoryTree from '@/components/DirectoryTree.vue'

const store = useVideoStore()
const router = useRouter()
const mainContentRef = ref<HTMLElement | null>(null)

// 当搜索或目录变化时，回到第一页
watch([() => store.searchQuery, () => store.selectedDirectory], () => {
  store.goToPage(1)
})

function scrollToTop() {
  if (mainContentRef.value) {
    mainContentRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function scrollToBottom() {
  if (mainContentRef.value) {
    mainContentRef.value.scrollTo({
      top: mainContentRef.value.scrollHeight,
      behavior: 'smooth',
    })
  }
}

onMounted(async () => {
  await store.loadVideos()
  await store.getScanStatus()

  setInterval(() => {
    store.getScanStatus()
  }, 2000)
})

async function handleScan() {
  await store.startScan()
  setTimeout(async () => {
    await store.loadVideos()
  }, 3000)
}

function playVideo(video: any) {
  store.addToRecent(video.id)
  router.push({ name: 'video', params: { id: video.id } })
}

function goToHistory() {
  router.push({ name: 'history' })
}

function getDirectoryName(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}
</script>
