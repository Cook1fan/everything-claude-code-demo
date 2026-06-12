<template>
  <div class="tag-filter">
    <!-- 标题和模式切换 -->
    <div class="tag-filter-header">
      <span class="tag-filter-title">标签筛选</span>
      <div class="tag-filter-mode">
        <button
          :class="['mode-btn', { active: videoStore.tagFilterMode === 'OR' }]"
          @click="videoStore.setTagFilterMode('OR')"
        >
          或
        </button>
        <button
          :class="['mode-btn', { active: videoStore.tagFilterMode === 'AND' }]"
          @click="videoStore.setTagFilterMode('AND')"
        >
          且
        </button>
      </div>
    </div>

    <!-- 已选标签 -->
    <div v-if="videoStore.selectedTags.length > 0" class="selected-tags">
      <span
        v-for="tag in videoStore.selectedTags"
        :key="tag"
        class="selected-tag"
        @click="videoStore.toggleTag(tag)"
      >
        {{ tag }}
        <span class="remove-icon">×</span>
      </span>
      <button class="clear-all-btn" @click="videoStore.clearTags">
        清除全部
      </button>
    </div>

    <!-- 标签列表 -->
    <div class="tag-list">
      <button
        v-for="tag in videoStore.availableTags"
        :key="tag.name"
        :class="['tag-chip', { selected: videoStore.isTagSelected(tag.name) }]"
        @click="videoStore.toggleTag(tag.name)"
        :title="`${tag.name}: ${tag.count} 个视频`"
      >
        <span class="tag-name">{{ tag.name }}</span>
        <span class="tag-count">{{ tag.count }}</span>
      </button>
    </div>

    <!-- 统计信息 -->
    <div class="tag-filter-footer">
      <span class="result-count">
        {{ videoStore.filteredVideos.length }} / {{ videoStore.videos.length }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVideoStore } from '@/stores/videoStore'

const videoStore = useVideoStore()
</script>

<style scoped>
.tag-filter {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tag-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tag-filter-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.tag-filter-mode {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 2px;
}

.mode-btn {
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}

.mode-btn.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(99, 102, 241, 0.3);
  border: 1px solid rgba(99, 102, 241, 0.5);
  border-radius: 12px;
  font-size: 12px;
  color: #a5b4fc;
  cursor: pointer;
  transition: all 0.15s;
}

.selected-tag:hover {
  background: rgba(99, 102, 241, 0.4);
}

.remove-icon {
  font-size: 14px;
  line-height: 1;
  opacity: 0.7;
}

.remove-icon:hover {
  opacity: 1;
}

.clear-all-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-all-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.8);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.tag-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.tag-chip.selected {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
  color: #a5b4fc;
}

.tag-name {
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-count {
  font-size: 10px;
  opacity: 0.6;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.tag-chip.selected .tag-count {
  background: rgba(99, 102, 241, 0.3);
}

.tag-filter-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.result-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* 滚动条样式 */
.tag-list::-webkit-scrollbar {
  width: 4px;
}

.tag-list::-webkit-scrollbar-track {
  background: transparent;
}

.tag-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.tag-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>