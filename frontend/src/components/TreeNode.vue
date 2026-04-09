<template>
  <div class="tree-node">
    <div
      :class="[
        'node-item',
        { 'is-selected': node.path === selectedPath }
      ]"
      @click="handleClick"
    >
      <button
        v-if="node.children.length > 0"
        @click.stop="handleToggle"
        class="toggle-btn"
      >
        <span :class="['arrow', { expanded: isExpanded }]">▶</span>
      </button>
      <span v-else class="spacer"></span>

      <span class="icon">
        {{ node.children.length > 0 ? (isExpanded ? '📂' : '📁') : '📁' }}
      </span>

      <span class="name">{{ node.name }}</span>

      <span v-if="node.videoCount > 0" class="count">
        {{ node.videoCount }}
      </span>
    </div>

    <div v-if="node.children.length > 0 && isExpanded" class="children">
      <TreeNode
        v-for="child in sortedChildren"
        :key="child.path"
        :node="child"
        :selected-path="selectedPath"
        :expanded-paths="expandedPaths"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DirectoryTreeNode } from '@/types'

const props = defineProps<{
  node: DirectoryTreeNode
  selectedPath: string
  expandedPaths: Set<string>
}>()

const emit = defineEmits<{
  toggle: [path: string]
  select: [path: string]
}>()

const isExpanded = computed(() => props.expandedPaths.has(props.node.path))

// 子节点按视频数降序排序，视频数相同则按名称排序
const sortedChildren = computed(() => {
  return [...props.node.children].sort((a, b) => {
    if (b.videoCount !== a.videoCount) {
      return b.videoCount - a.videoCount
    }
    return a.name.localeCompare(b.name)
  })
})

function handleToggle() {
  emit('toggle', props.node.path)
}

function handleClick() {
  emit('select', props.node.path)
}
</script>

<style scoped>
.tree-node {
  position: relative;
}

.node-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.node-item:hover {
  background-color: rgba(59, 130, 246, 0.1);
}

.node-item.is-selected {
  background-color: rgba(59, 130, 246, 0.2);
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 4px;
}

.toggle-btn:hover {
  background-color: rgba(59, 130, 246, 0.2);
}

.arrow {
  display: inline-block;
  font-size: 10px;
  transition: transform 0.15s;
  color: #94a3b8;
}

.arrow.expanded {
  transform: rotate(90deg);
}

.spacer {
  width: 20px;
}

.icon {
  margin-right: 6px;
  font-size: 16px;
}

.name {
  flex: 1;
  font-size: 13px;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  margin-left: 8px;
  padding: 2px 6px;
  font-size: 11px;
  background-color: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  border-radius: 10px;
}

.children {
  margin-left: 20px;
}
</style>
