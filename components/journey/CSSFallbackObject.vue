<template>
  <div class="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
    <div
      class="journey-blob"
      :style="{
        transform: `scale(${scale})`,
        opacity: opacity,
        filter: `blur(${blur}px)`,
        '--blob-color-1': blobColor1,
        '--blob-color-2': blobColor2,
      }"
    />
  </div>
</template>

<script setup lang="ts">
import type { EmotionalState } from '~/composables/useScrollJourney'

const props = defineProps<{
  scale: number
  opacity: number
  blur: number
  state: EmotionalState
}>()

const BLOB_COLORS: Record<EmotionalState, [string, string]> = {
  crisis:    ['#4a1525', '#2d0a15'],
  awareness: ['#5a3a2a', '#3a2015'],
  process:   ['#2a5a3d', '#1a3a25'],
  relief:    ['#b1cdc2', '#cce9dd'],
}

const blobColor1 = computed(() => BLOB_COLORS[props.state][0])
const blobColor2 = computed(() => BLOB_COLORS[props.state][1])
</script>
