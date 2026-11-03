<template>
  <!-- Shown only while <html> has .cm-intro (set pre-paint by the head script in nuxt.config.ts:
       first visit of the session, no reduced-motion). Adapted from BYQ gem liquid-wordmark-fill-preloader-01. -->
  <div class="cm-intro-overlay" aria-hidden="true">
    <div class="relative font-headline italic text-5xl sm:text-7xl leading-none whitespace-nowrap">
      <span class="cm-intro-outline block">Chantal Massé</span>
      <span ref="fillEl" class="cm-intro-fill absolute inset-0 block text-secondary">Chantal Massé</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const fillEl = ref<HTMLElement | null>(null)

const FILL_MS = 1400
const HOLD_MS = 300
const LIFT_MS = 500
const POINTS = 16
const AMP = 3

onMounted(() => {
  const html = document.documentElement
  if (!html.classList.contains('cm-intro')) return

  // Hydrated late (slow network): don't make the visitor wait for the full fill.
  const late = performance.now() > 1200
  const fillMs = late ? 0 : FILL_MS
  const start = performance.now()
  let raf = 0

  const render = (now: number) => {
    const t = now - start
    const progress = Math.min(1, fillMs ? t / fillMs : 1)
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2
    const base = 100 - eased * 110
    const pts: string[] = []
    for (let i = 0; i <= POINTS; i++) {
      const wave = AMP * Math.sin((i / POINTS) * Math.PI * 4 + t / 300)
      pts.push(`${(i / POINTS) * 100}% ${(base + wave).toFixed(2)}%`)
    }
    if (fillEl.value) fillEl.value.style.clipPath = `polygon(${pts.join(', ')}, 100% 130%, 0% 130%)`
    if (t < fillMs + HOLD_MS) raf = requestAnimationFrame(render)
  }
  raf = requestAnimationFrame(render)

  const outTimer = setTimeout(() => html.classList.add('cm-intro-out'), fillMs + HOLD_MS)
  const doneTimer = setTimeout(() => {
    cancelAnimationFrame(raf)
    html.classList.remove('cm-intro', 'cm-intro-out')
  }, fillMs + HOLD_MS + LIFT_MS)

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
    clearTimeout(outTimer)
    clearTimeout(doneTimer)
    html.classList.remove('cm-intro', 'cm-intro-out')
  })
})
</script>
