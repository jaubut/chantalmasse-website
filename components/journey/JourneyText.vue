<template>
  <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-8 z-10">
    <div class="relative flex flex-col items-center">
      <div
        v-for="s in journeyStates"
        v-show="state === s.key"
        :key="s.key"
        class="absolute flex flex-col items-center"
        :style="{
          filter: `blur(${textBlur}px)`,
          opacity: textOpacity,
          transition: 'filter 0.6s ease-out, opacity 0.5s ease-out',
        }"
      >
        <!-- Headline: Newsreader italic, massive, tight tracking -->
        <h2
          class="font-headline italic text-white mb-6 leading-[1.05]"
          style="font-size: clamp(2.5rem, 8vw, 6rem); letter-spacing: -0.02em;"
        >
          {{ s.headline }}
        </h2>

        <!-- Subtext: Manrope light, generous leading -->
        <p
          class="text-white/70 font-light max-w-2xl"
          style="font-size: clamp(1rem, 2.5vw, 1.25rem); line-height: 1.8;"
        >
          {{ s.subtext }}
        </p>

        <!-- Micro-copy: social proof / normalisation whisper -->
        <p
          v-if="s.microcopy"
          class="text-white/40 font-light mt-6"
          style="font-size: clamp(0.75rem, 1.5vw, 0.875rem); line-height: 1.6;"
        >
          {{ s.microcopy }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmotionalState } from '~/composables/useScrollJourney'
import { journeyStates } from '~/lib/journey-data'

defineProps<{
  state: EmotionalState
  textBlur: number
  textOpacity: number
}>()
</script>
