<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  progress: number
}>()

const x = ref(0)
const y = ref(0)
const visible = ref(false)
let target = { x: 0, y: 0 }
let raf: number

function onMove(e: MouseEvent) {
  target.x = e.clientX
  target.y = e.clientY
  if (!visible.value) visible.value = true
}

function onLeave() {
  visible.value = false
}

const lag = 0.15

function animate() {
  x.value += (target.x - x.value) * lag
  y.value += (target.y - y.value) * lag
  raf = requestAnimationFrame(animate)
}

// Soul grows as scroll progresses — aura around the cursor
const size = computed(() => 40 + props.progress * 60)
const blur = computed(() => 6 + props.progress * 4)
const opacity = computed(() => 0.4 + props.progress * 0.35)

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia('(pointer: coarse)').matches) return // no cursor on touch
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseleave', onLeave)
  raf = requestAnimationFrame(animate)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseleave', onLeave)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div
    v-show="visible"
    class="cursor-soul hidden md:block"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      transform: `translate(${x - size / 2}px, ${y - size / 2}px)`,
      filter: `blur(${blur}px)`,
      opacity,
    }"
  />
</template>

<style scoped>
.cursor-soul {
  position: fixed;
  top: 0;
  left: 0;
  border-radius: 40% 60% 55% 45% / 55% 40% 60% 45%;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
  z-index: 50;
  will-change: transform;
  animation: soul-morph 6s ease-in-out infinite;
}

@keyframes soul-morph {
  0%, 100% { border-radius: 40% 60% 55% 45% / 55% 40% 60% 45%; }
  33%      { border-radius: 55% 45% 40% 60% / 45% 55% 50% 50%; }
  66%      { border-radius: 45% 55% 60% 40% / 60% 45% 40% 55%; }
}

@media (prefers-reduced-motion: reduce) {
  .cursor-soul { animation: none; display: none; }
}
</style>
