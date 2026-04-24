<template>
  <div class="flex flex-col h-screen">
    <!-- 统一的顶部导航栏 -->
    <AppHeader />

    <!-- 页面内容区域 -->
    <main class="flex-1 overflow-hidden">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
</script>
