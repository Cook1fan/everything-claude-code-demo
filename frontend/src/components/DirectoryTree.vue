<template>
  <div class="directory-tree">
    <div
      v-for="node in sortedNodes"
      :key="node.path"
    >
      <TreeNode
        :node="node"
        :selected-path="selectedPath"
        :expanded-paths="expandedPaths"
        @toggle="handleToggle"
        @select="handleSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DirectoryTreeNode } from '@/types'
import TreeNode from './TreeNode.vue'

const props = defineProps<{
  nodes: DirectoryTreeNode[]
  selectedPath: string
  expandedPaths: Set<string>
}>()

// 按视频数降序排序，视频数相同则按名称排序
const sortedNodes = computed(() => {
  return [...props.nodes].sort((a, b) => {
    if (b.videoCount !== a.videoCount) {
      return b.videoCount - a.videoCount
    }
    return a.name.localeCompare(b.name)
  })
})

const emit = defineEmits<{
  toggle: [path: string]
  select: [path: string]
}>()

function handleToggle(path: string) {
  emit('toggle', path)
}

function handleSelect(path: string) {
  emit('select', path)
}
</script>

<style scoped>
.directory-tree {
  user-select: none;
}
</style>
