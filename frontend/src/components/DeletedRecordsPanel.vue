<template>
  <div
    v-if="visible"
    data-test="deletion-panel"
    class="mx-6 mt-4 mb-2"
  >
    <div
      class="rounded-md border border-amber-500/40 bg-amber-500/10 overflow-hidden"
      style="box-shadow: 0 1px 2px rgba(0,0,0,0.1);"
    >
      <!-- 可折叠头部 -->
      <button
        type="button"
        data-test="panel-toggle"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10 transition-colors"
        @click="toggleExpand"
        :aria-expanded="expanded"
        aria-controls="deletion-records-list"
      >
        <span
          aria-hidden="true"
          class="inline-block text-[10px] transition-transform text-amber-400"
          :class="{ 'rotate-90': expanded }"
        >▶</span>
        <span class="text-amber-400" aria-hidden="true">⚠</span>
        <span data-test="panel-count" class="font-medium text-amber-200">
          {{ records.length }} 条已删除视频记录
        </span>
        <span class="ml-auto text-xs text-amber-400/70">
          {{ expanded ? '收起' : '展开' }}
        </span>
      </button>

      <!-- 展开内容 -->
      <ul
        v-if="expanded"
        id="deletion-records-list"
        data-test="records-list"
        class="max-h-40 overflow-y-auto text-xs border-t border-amber-500/30 bg-slate-900/40 px-3 py-1.5 space-y-0.5"
      >
        <li
          v-for="(record, idx) in records"
          :key="idx"
          class="flex items-baseline gap-2 leading-relaxed py-0.5"
        >
          <span class="text-amber-400/70 font-mono text-[10px] shrink-0">
            {{ formatTimestamp(record.timestamp) }}
          </span>
          <span class="text-slate-300 break-all">
            {{ record.path }}
          </span>
        </li>
      </ul>
    </div>
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
