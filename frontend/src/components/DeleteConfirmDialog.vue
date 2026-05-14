<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- 背景遮罩 -->
    <div class="absolute inset-0 bg-black/70" @click="closeDialog"></div>

    <!-- 对话框 -->
    <div class="relative bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
      <!-- 标题栏 -->
      <div class="p-6 border-b border-slate-700">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center">
            <span class="text-2xl">🗑️</span>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">确认删除</h2>
            <p class="text-sm text-slate-400">此操作不可撤销</p>
          </div>
        </div>
      </div>

      <!-- 内容 -->
      <div class="p-6">
        <div class="mb-4">
          <p class="text-slate-300 mb-2">
            你确定要删除以下目录及其所有内容吗？
          </p>
          <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-200 break-all">
            {{ directoryPath }}
          </div>
        </div>

        <div class="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <span class="text-yellow-500 text-lg">⚠️</span>
            <div class="text-sm text-yellow-200">
              <p class="font-medium mb-1">注意事项：</p>
              <ul class="list-disc list-inside space-y-1 text-yellow-200/80">
                <li>这将永久删除该目录下的所有文件</li>
                <li>包括视频、海报、雪碧图等所有文件</li>
                <li>删除后无法恢复</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 确认输入框 -->
        <div class="mt-6">
          <label class="block text-sm text-slate-400 mb-2">
            请输入 <span class="text-white font-medium">{{ confirmText }}</span> 确认删除：
          </label>
          <input
            v-model="userInput"
            type="text"
            class="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            :placeholder="confirmText"
            @keyup.enter="handleConfirm"
          />
        </div>
      </div>

      <!-- 按钮 -->
      <div class="p-6 border-t border-slate-700 flex gap-3">
        <button
          @click="closeDialog"
          class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          @click="handleConfirm"
          :disabled="!canConfirm || deleting"
          class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span v-if="deleting" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>{{ deleting ? '删除中...' : '确认删除' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  show: boolean
  directoryPath: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
}>()

const userInput = ref('')
const deleting = ref(false)
const confirmText = '确认删除'

const canConfirm = computed(() => userInput.value === confirmText)

function closeDialog() {
  emit('update:show', false)
}

function handleConfirm() {
  if (!canConfirm.value || deleting.value) return
  emit('confirm')
}

// 重置状态
function reset() {
  userInput.value = ''
  deleting.value = false
}

// 监听 show 变化
let lastShow = false
watch(() => props.show, (newVal) => {
  if (newVal && !lastShow) {
    reset()
  }
  lastShow = newVal
})

// 暴露 deleting 状态供父组件控制
defineExpose({
  setDeleting: (val: boolean) => { deleting.value = val }
})
</script>
