<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    :viewBox="svg.viewBox"
    aria-hidden="true"
    role="img"
    :class="['iconify', `iconify--${prefix}`]"
    v-html="svg.body"
  />
</template>

<script setup lang="ts">
// Drop-in for @iconify/vue's <Icon icon="prefix:name">: same root <svg> (class/style fall through), but the paths come
// from astro/src/icons.json at build time, so prerendered HTML already has the icon (no api.iconify.design fetch).
import { computed } from 'vue'
import icons from '../icons.json'

const props = defineProps<{ icon: string }>()
const map = icons as Record<string, string>

const prefix = computed(() => props.icon.split(':')[0])
const svg = computed(() => {
  const raw = map[props.icon]
  if (!raw) throw new Error(`Icon ${props.icon} missing from astro/src/icons.json: run bun astro/scripts/gen-icons.ts`)
  return {
    viewBox: raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24',
    body: raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''),
  }
})
</script>
