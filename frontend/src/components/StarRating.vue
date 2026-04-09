<template>
  <div class="flex items-center gap-0.5" @click.stop>
    <button
      v-for="star in 10"
      :key="star"
      @click="setRating(star)"
      @mouseenter="handleMouseEnter(star)"
      @mouseleave="handleMouseLeave"
      class="text-xl transition-transform"
      :class="[
        star <= displayRating ? 'text-yellow-400' : 'text-slate-600',
        !readonly ? 'hover:scale-125 cursor-pointer' : 'cursor-default'
      ]"
    >
      ★
    </button>
    <span v-if="showNumber && displayRating > 0" class="ml-2 text-sm text-yellow-400 font-medium">
      {{ displayRating }}/10
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: number
  readonly?: boolean
  showNumber?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const hoverRating = ref(0)

const displayRating = computed(() => {
  if (props.readonly) return props.modelValue
  return hoverRating.value || props.modelValue
})

function setRating(rating: number) {
  if (props.readonly) return
  emit('update:modelValue', rating)
}

function handleMouseEnter(rating: number) {
  if (props.readonly) return
  hoverRating.value = rating
}

function handleMouseLeave() {
  if (props.readonly) return
  hoverRating.value = 0
}
</script>
