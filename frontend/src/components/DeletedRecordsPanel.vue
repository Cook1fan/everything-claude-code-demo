<template>
  <div
    v-if="visible"
    class="deleted-records-panel mb-4 bg-amber-900/20 border border-amber-700/50 rounded-lg overflow-hidden"
  >
    <!-- 可折叠头部 -->
    <button
      @click="toggleExpand"
      :aria-expanded="expanded"
      aria-controls="deletion-records-list"
      class="w-full px-4 py-3 flex items-center gap-2 hover:bg-amber-900/30 transition-colors"
    >
      <span
        aria-hidden="true"
        :class="[
          'inline-block text-xs text-amber-400 transition-transform',
          expanded ? 'rotate-90' : ''
        ]"
      >▶</span>
      <span aria-hidden="true" class="text-base">📋</span>
      <span class="text-amber-200 font-medium text-sm">
        {{ records.length }} 条删除记录
      </span>
    </button>

    <!-- 展开内容 -->
    <ul
      v-if="expanded"
      id="deletion-records-list"
      class="border-t border-amber-700/50 px-4 py-2 max-h-64 overflow-y-auto"
    >
      <li
        v-for="(record, idx) in records"
        :key="idx"
        class="py-1.5 text-sm flex items-baseline gap-3 border-b border-amber-800/30 last:border-b-0"
      >
        <span class="text-amber-400/70 font-mono text-xs whitespace-nowrap">
          {{ record.timestamp }}
        </span>
        <span class="text-slate-300 break-all">
          {{ record.path }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import type { DeletionRecord } from '@/types'

const props = defineProps<{
  directoryPath: string
}>()

const store = useVideoStore()

const records = ref<DeletionRecord[]>([])
const expanded = ref(false)
const visible = ref(false)

function toggleExpand() {
  expanded.value = !expanded.value
}

let requestSeq = 0
watch(
  () => props.directoryPath,
  async (newPath) => {
    const seq = ++requestSeq
    // 重置状态
    records.value = []
    visible.value = false
    expanded.value = false

    if (!newPath) return

    // 异步加载进行中；新请求会通过 seq 检查丢弃过期响应
    const result = await store.loadDeletionRecords(newPath)
    if (seq !== requestSeq) return  // newer request superseded us

    if (result.exists && result.records.length > 0) {
      records.value = result.records
      visible.value = true
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.deleted-records-panel {
  position: relative;
}
</style>