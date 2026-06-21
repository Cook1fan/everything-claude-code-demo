<template>
  <div
    v-if="visible"
    data-test="deletion-panel"
    style="margin-bottom: 16px; min-height: 60px; flex-shrink: 0; background-color: rgba(245, 158, 11, 0.2); border: 3px solid #f59e0b; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.3); position: sticky; top: 0; z-index: 10;"
  >
    <!-- 可折叠头部 -->
    <button
      type="button"
      data-test="panel-toggle"
      @click="toggleExpand"
      :aria-expanded="expanded"
      aria-controls="deletion-records-list"
      style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 16px; background-color: transparent; border: none; cursor: pointer; color: #fef3c7; font-size: 18px; font-weight: 600; text-align: left;"
    >
      <span
        aria-hidden="true"
        :style="{
          display: 'inline-block',
          color: '#fcd34d',
          fontSize: '20px',
          fontWeight: 'bold',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }"
      >▶</span>
      <span aria-hidden="true" style="font-size: 24px;">📋</span>
      <span data-test="panel-count" style="color: #fef3c7; font-size: 18px; font-weight: 600;">
        {{ records.length }} 条删除记录
      </span>
      <span style="margin-left: auto; color: #fcd34d; font-size: 13px; opacity: 0.7;">点击展开 ▼</span>
    </button>

    <!-- 展开内容 -->
    <ul
      v-if="expanded"
      id="deletion-records-list"
      data-test="records-list"
      style="border-top: 2px solid #f59e0b; background-color: rgba(15, 23, 42, 0.7); padding: 12px 16px; max-height: 256px; overflow-y: auto; list-style: none; margin: 0;"
    >
      <li
        v-for="(record, idx) in records"
        :key="idx"
        style="padding: 8px 0; font-size: 14px; display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid rgba(245, 158, 11, 0.2);"
      >
        <span style="color: #fcd34d; font-family: monospace; font-size: 12px; white-space: nowrap; font-weight: 600;">
          {{ record.timestamp }}
        </span>
        <span style="color: #e2e8f0; word-break: break-all;">
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

    console.log('[DeletedRecordsPanel] watch fired, newPath:', newPath, 'seq:', seq)

    if (!newPath) {
      console.log('[DeletedRecordsPanel] newPath empty, skip')
      return
    }

    // 异步加载进行中；新请求会通过 seq 检查丢弃过期响应
    const result = await store.loadDeletionRecords(newPath)
    console.log('[DeletedRecordsPanel] API result:', JSON.stringify(result), 'seq check:', seq === requestSeq)

    if (seq !== requestSeq) {
      console.log('[DeletedRecordsPanel] seq mismatch, skip')
      return  // newer request superseded us
    }

    if (result.exists && result.records.length > 0) {
      records.value = result.records
      visible.value = true
      console.log('[DeletedRecordsPanel] set visible=true, records:', records.value.length)
    } else {
      console.log('[DeletedRecordsPanel] condition not met:', { exists: result.exists, length: result.records?.length })
    }
  },
  { immediate: true }
)
</script>