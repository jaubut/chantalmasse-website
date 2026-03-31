<template>
  <div
    class="absolute inset-0 transition-[background] duration-700 ease-out"
    :style="{ background: gradient }"
  />
</template>

<script setup lang="ts">
defineProps<{
  gradient: string
}>()
</script>
