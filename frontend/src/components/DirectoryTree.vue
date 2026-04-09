<template>
  <div class="directory-tree">
    <div
      v-for="node in nodes"
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
import type { DirectoryTreeNode } from '@/types'
import TreeNode from './TreeNode.vue'

defineProps<{
  nodes: DirectoryTreeNode[]
  selectedPath: string
  expandedPaths: Set<string>
}>()

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
