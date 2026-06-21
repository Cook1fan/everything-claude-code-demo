<template>
  <div
    v-if="visible"
    class="deleted-records-panel mb-4 bg-amber-900/20 border border-amber-700/50 rounded-lg overflow-hidden"
  >
    <!-- 可折叠头部 -->
    <button
      @click="toggleExpand"
      class="w-full px-4 py-3 flex items-center gap-2 hover:bg-amber-900/30 transition-colors"
    >
      <span
        :class="[
          'inline-block text-xs text-amber-400 transition-transform',
          expanded ? 'rotate-90' : ''
        ]"
      >▶</span>
      <span class="text-base">📋</span>
      <span class="text-amber-200 font-medium text-sm">
        {{ records.length }} 条删除记录
      </span>
    </button>

    <!-- 展开内容 -->
    <ul
      v-if="expanded"
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
const loading = ref(false)

function toggleExpand() {
  expanded.value = !expanded.value
}

watch(
  () => props.directoryPath,
  async (newPath) => {
    // 重置状态
    records.value = []
    visible.value = false
    expanded.value = false

    if (!newPath) return

    loading.value = true
    const result = await store.loadDeletionRecords(newPath)
    loading.value = false

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