<template>
  <div ref="containerRef" class="journey-page">

    <!-- Fixed gradient background that transitions with scroll -->
    <div
      class="fixed inset-0 -z-10 transition-[background] duration-700 ease-out"
      :style="{ background: currentGradient }"
    />

    <!-- Decorative blob — blur decreases as you scroll -->
    <div class="fixed inset-0 flex items-center justify-center -z-10 pointer-events-none">
      <div
        class="journey-blob"
        :style="{
          transform: `scale(${objectScale})`,
          opacity: objectOpacity * 0.4,
          filter: `blur(${objectBlur}px)`,
          '--blob-color-1': blobColors[0],
          '--blob-color-2': blobColors[1],
        }"
      />
    </div>

    <!-- Cursor soul — follows mouse, grows with scroll progress -->
    <CursorSoul :progress="progress" />

    <!-- Hero -->
    <section class="min-h-screen flex flex-col justify-end px-8 lg:px-20 pb-24 pt-32">
      <div class="max-w-screen-xl mx-auto w-full">
        <h1
          class="font-headline italic text-white leading-[1.05] mb-6"
          style="font-size: clamp(2.5rem, 7vw, 5rem); letter-spacing: -0.02em;"
          data-animate
        >{{ journeyHero.headline }}</h1>
        <p
          class="text-white/60 font-light max-w-2xl mb-12"
          style="font-size: clamp(1rem, 2.5vw, 1.25rem); line-height: 1.8;"
          data-animate
        >{{ journeyHero.subtext }}</p>
        <div class="flex items-center gap-3 text-white/30" data-animate>
          <div class="w-8 h-px bg-white/20" />
          <span
            class="font-body uppercase"
            style="font-size: 0.6875rem; letter-spacing: 0.2em;"
          >{{ journeyHero.scrollLabel }}</span>
        </div>
      </div>
    </section>

    <!-- Bento sections -->
    <JourneyBentoSection
      v-for="(section, i) in journeySections"
      :key="section.id"
      :section="section"
      :light="i === journeySections.length - 1"
    />

    <!-- Final CTA -->
    <section class="px-8 lg:px-20 py-32">
      <div class="max-w-screen-xl mx-auto text-center">
        <h2
          class="font-headline italic text-primary leading-[1.1] mb-4"
          style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.02em;"
          data-animate
        >{{ journeyCTA.headline }}</h2>
        <p
          class="text-on-surface-variant font-light max-w-xl mx-auto mb-12"
          style="font-size: clamp(0.95rem, 2vw, 1.125rem); line-height: 1.8;"
          data-animate
        >{{ journeyCTA.subtext }}</p>
        <button
          class="bg-primary text-on-primary px-12 py-5 rounded-xl text-lg font-semibold hover:bg-primary-container transition-colors"
          :aria-label="journeyCTA.ariaLabel"
          data-animate
          @click="booking.open()"
        >{{ journeyCTA.label }}</button>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import JourneyBentoSection from '~/components/journey/JourneyBentoSection.vue'
import CursorSoul from '~/components/journey/CursorSoul.vue'
import { journeyHero, journeySections, journeyCTA } from '~/utils/journey-data'
import type { EmotionalState } from '~/composables/useScrollJourney'

const booking = useBooking()

const {
  progress,
  containerRef,
  currentGradient,
  objectScale,
  objectOpacity,
  objectBlur,
  currentState,
} = useScrollJourney()

const BLOB_COLORS: Record<EmotionalState, [string, string]> = {
  crisis:    ['#4a3555', '#30273a'],
  awareness: ['#5a4040', '#3d2d30'],
  process:   ['#3a6a50', '#2f4035'],
  relief:    ['#b1cdc2', '#d5e0d8'],
}

const blobColors = computed(() => BLOB_COLORS[currentState.value])
</script>
