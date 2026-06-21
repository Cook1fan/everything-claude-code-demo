<template>
  <div
    v-if="visible"
    data-test="deletion-panel"
    class="mx-6 mt-4"
  >
    <!-- 可折叠头部 -->
    <button
      type="button"
      data-test="panel-toggle"
      class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      @click="toggleExpand"
      :aria-expanded="expanded"
      aria-controls="deletion-records-list"
    >
      <span
        aria-hidden="true"
        class="inline-block text-[10px] transition-transform"
        :class="{ 'rotate-90': expanded }"
      >▶</span>
      <span data-test="panel-count" class="text-slate-500">
        {{ records.length }} 条已删除视频记录
      </span>
    </button>

    <!-- 展开内容 -->
    <ul
      v-if="expanded"
      id="deletion-records-list"
      data-test="records-list"
      class="mt-1 max-h-48 overflow-y-auto text-xs text-slate-500 space-y-0.5 pl-5"
    >
      <li
        v-for="(record, idx) in records"
        :key="idx"
        class="flex items-baseline gap-2 leading-relaxed"
      >
        <span class="text-slate-600 font-mono text-[10px] shrink-0">
          {{ formatTimestamp(record.timestamp) }}
        </span>
        <span class="text-slate-400 break-all">
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

function formatTimestamp(ts: string): string {
  // 形如 "2026-06-18T07:37:52.998Z" → "06-18 07:37"
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return ts
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`
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

    if (seq !== requestSeq) return // newer request superseded us

    if (result.exists && result.records.length > 0) {
      records.value = result.records
      visible.value = true
    }
  },
  { immediate: true }
)
</script>
