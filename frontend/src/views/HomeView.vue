<template>
  <AppLayout>
    <div class="flex h-full overflow-hidden">
      <!-- 侧边栏 -->
      <aside
        v-if="sidebarOpen"
        class="w-72 bg-slate-800 border-r border-slate-700 overflow-y-auto flex flex-col"
      >
        <div class="p-4 flex-1 flex flex-col">
          <!-- 搜索框 -->
          <div class="mb-4 relative">
            <input
              v-model="store.searchQuery"
              type="text"
              placeholder="搜索视频..."
              class="w-full px-3 py-2 pr-8 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            <button
              v-if="store.searchQuery"
              @click="store.searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title="清除搜索"
            >
              ×
            </button>
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

          <!-- 标签筛选 -->
          <TagFilter v-if="store.availableTags.length > 0" />

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
        </div>

        <!-- 折叠按钮 - 在侧边栏底部 -->
        <div class="p-3 border-t border-slate-700">
          <button
            @click="sidebarOpen = false"
            class="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>◀</span>
            收起侧边栏
          </button>
        </div>
      </aside>

      <!-- 展开按钮 - 当侧边栏收起时显示在左侧 -->
      <button
        v-if="!sidebarOpen"
        @click="sidebarOpen = true"
        class="fixed left-2 top-1/2 -translate-y-1/2 z-10 bg-slate-700 hover:bg-slate-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
        title="展开侧边栏"
      >
        ▶
      </button>

      <!-- 主内容区 -->
      <main ref="mainContentRef" class="flex-1 overflow-y-auto p-6 flex flex-col">
        <!-- 面包屑导航和控制栏 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div v-if="store.searchQuery" class="text-slate-300 text-sm">
              搜索 "<span class="text-white font-medium">{{ store.searchQuery }}</span>"
              <span class="text-slate-400 ml-2">
                ({{ sortedVideos.length }} 个结果)
              </span>
            </div>
            <div v-else-if="store.selectedDirectory" class="flex items-center gap-2 text-sm">
              <button
                @click="store.selectedDirectory = ''"
                class="text-blue-400 hover:text-blue-300"
              >
                全部视频
              </button>
              <span class="text-slate-600">/</span>
              <span class="text-slate-300">{{ getDirectoryName(store.selectedDirectory) }}</span>
              <span class="text-slate-400">
                ({{ sortedVideos.length }} 个视频)
              </span>
            </div>
            <div v-else class="text-slate-400 text-sm">
              全部视频
              <span class="text-slate-300 ml-1">
                ({{ sortedVideos.length }} 个视频)
              </span>
            </div>
          </div>

          <!-- 排序和分页控制 -->
          <div class="flex items-center gap-3">
            <!-- 排序 -->
            <div class="flex items-center gap-2">
              <span class="text-slate-400 text-sm">排序:</span>
              <select
                :value="sortMode"
                @change="handleSortModeChange"
                class="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="default">默认</option>
                <option value="random">随机</option>
                <option value="name">名称</option>
                <option value="date">日期</option>
                <option value="rating">星级</option>
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
            <div v-if="totalPages > 1" class="flex items-center gap-2">
              <button
                @click="store.prevPage()"
                :disabled="store.currentPage === 1"
                class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
              >
                ← 上一页
              </button>
              <span class="text-slate-400 text-sm">
                {{ store.currentPage }} / {{ totalPages }}
              </span>
              <button
                @click="store.nextPage()"
                :disabled="store.currentPage === totalPages"
                class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
              >
                下一页 →
              </button>
            </div>
          </div>
        </div>

        <!-- 删除记录面板 -->
        <DeletedRecordsPanel
          v-if="store.selectedDirectory"
          :directory-path="store.selectedDirectory"
        />

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

        <div v-else class="flex-1 min-h-0 flex flex-col">
          <!-- 视频网格 -->
          <div class="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start">
            <VideoCard
              v-for="video in prioritizedPagedVideos"
              :key="video.id"
              :video="video"
              @click="playVideo(video)"
              @delete="handleDeleteVideo(video)"
            />
          </div>

          <!-- 底部分页控件 -->
          <div v-if="totalPages > 1" class="mt-6 flex items-center justify-center gap-2">
            <button
              @click="store.prevPage()"
              :disabled="store.currentPage === 1"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              上一页
            </button>
            <span class="text-slate-400 px-4">
              第 {{ store.currentPage }} / {{ totalPages }} 页
              <span class="text-slate-500 ml-2">
                (共 {{ sortedVideos.length }} 个视频)
              </span>
            </span>
            <button
              @click="store.nextPage()"
              :disabled="store.currentPage === totalPages"
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

    <!-- 删除确认对话框 -->
    <DeleteConfirmDialog
      ref="deleteConfirmDialogRef"
      v-model:show="showDeleteDialog"
      :directory-path="deletingDirectory || ''"
      @confirm="confirmDelete"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, watch, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useVideoStore, type SortMode as StoreSortMode } from '@/stores/videoStore'
import { usePlayHistoryStore } from '@/stores/playHistoryStore'
import VideoCard from '@/components/VideoCard.vue'
import DirectoryTree from '@/components/DirectoryTree.vue'
import AppLayout from '@/components/AppLayout.vue'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue'
import TagFilter from '@/components/TagFilter.vue'
import DeletedRecordsPanel from '@/components/DeletedRecordsPanel.vue'
import type { Video } from '@/types'

type SortMode = StoreSortMode | 'rating'

const store = useVideoStore()
const playHistory = usePlayHistoryStore()
const router = useRouter()
const mainContentRef = ref<HTMLElement | null>(null)

// 从 localStorage 读取侧边栏状态
const sidebarOpen = ref(localStorage.getItem('sidebarOpen') !== 'false')

// 监听侧边栏状态变化，保存到 localStorage
watch(sidebarOpen, (newValue) => {
  localStorage.setItem('sidebarOpen', newValue.toString())
})

// 本地排序模式（用于支持星级排序，这个不保存到 store）
const localSortMode = ref<SortMode>(store.sortMode)

const sortMode = computed({
  get: () => localSortMode.value,
  set: (val: SortMode) => {
    localSortMode.value = val
  }
})

function handleSortModeChange(e: Event) {
  const newMode = (e.target as HTMLSelectElement).value as SortMode
  if (newMode === 'rating') {
    localSortMode.value = 'rating'
    store.goToPage(1)
  } else {
    localSortMode.value = newMode
    store.setSortMode(newMode as StoreSortMode)
  }
}

// 排序后的视频列表
const sortedVideos = computed(() => {
  const allVideos = store.filteredVideos

  if (localSortMode.value !== 'rating') {
    // 使用 store 的原有排序逻辑
    return allVideos
  }

  // 星级排序：高的在前，未评分的在后
  return [...allVideos].sort((a, b) => {
    const ratingA = playHistory.getRating(a.id) || 0
    const ratingB = playHistory.getRating(b.id) || 0

    // 降序排序
    if (ratingB !== ratingA) {
      return ratingB - ratingA
    }

    // 评分相同时按名称排序
    return a.title.localeCompare(b.title)
  })
})

// 分页后的视频列表
const pagedVideos = computed(() => {
  const start = (store.currentPage - 1) * store.pageSize
  const end = start + store.pageSize
  return sortedVideos.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  if (localSortMode.value === 'rating') {
    return Math.ceil(sortedVideos.value.length / store.pageSize)
  }
  return store.totalPages
})

// 优先显示未播放视频的分页列表
const prioritizedPagedVideos = computed(() => {
  // 如果是星级排序，直接返回分页后的列表
  if (localSortMode.value === 'rating') {
    return pagedVideos.value
  }

  const allVideos = store.filteredVideos

  // 如果不是随机排序，直接返回原分页
  if (store.sortMode !== 'random') {
    return store.pagedVideos
  }

  // 将视频分为未播放和已播放两组
  const unplayed: Video[] = []
  const played: Video[] = []
  for (const video of allVideos) {
    if (playHistory.getPlayCount(video.id) === 0) {
      unplayed.push(video)
    } else {
      played.push(video)
    }
  }

  // 分别洗牌，未播放的放在前面
  const shuffledUnplayed = store.shuffleArray(unplayed, store.randomSeed)
  const shuffledPlayed = store.shuffleArray(played, store.randomSeed + 1)
  const prioritized = [...shuffledUnplayed, ...shuffledPlayed]

  // 分页
  const start = (store.currentPage - 1) * store.pageSize
  const end = start + store.pageSize
  return prioritized.slice(start, end)
})

// 当搜索、目录或排序变化时，回到第一页
watch([() => store.searchQuery, () => store.selectedDirectory, localSortMode], () => {
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

onMounted(() => {
  // 视频加载和状态更新已在 App.vue 中处理
})

async function handleScan() {
  await store.startScan()
  setTimeout(async () => {
    await store.loadVideos()
  }, 3000)
}

function playVideo(video: Video) {
  store.addToRecent(video.id)
  router.push({ name: 'video', params: { id: video.id } })
}

function getDirectoryName(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

// 删除功能
const showDeleteDialog = ref(false)
const deletingDirectory = ref<string | null>(null)
const deleteConfirmDialogRef = ref<InstanceType<typeof DeleteConfirmDialog> | null>(null)

function handleDeleteVideo(video: Video) {
  deletingDirectory.value = video.directory
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingDirectory.value) return

  if (deleteConfirmDialogRef.value) {
    deleteConfirmDialogRef.value.setDeleting(true)
  }

  try {
    // 先获取该目录及其子目录下的所有视频ID，以便清除播放历史
    const normalizedDir = deletingDirectory.value
    const videoIdsToDelete = store.videos
      .filter(v => {
        const videoDir = v.directory
        return videoDir === normalizedDir ||
               videoDir.startsWith(normalizedDir + '/')
      })
      .map(v => v.id)

    // 删除目录
    await store.deleteDirectory(deletingDirectory.value)

    // 清除播放历史
    for (const id of videoIdsToDelete) {
      await playHistory.deleteRecord(id)
    }

    // 重新加载视频列表
    await store.loadVideos()

    showDeleteDialog.value = false
    deletingDirectory.value = null
  } catch (err) {
    console.error('删除失败:', err)
    alert(err instanceof Error ? err.message : '删除失败，请检查控制台')
  } finally {
    if (deleteConfirmDialogRef.value) {
      deleteConfirmDialogRef.value.setDeleting(false)
    }
  }
}
</script>
