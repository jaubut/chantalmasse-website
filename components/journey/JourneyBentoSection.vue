<template>
  <section :id="section.id" class="px-8 lg:px-20 py-24">
    <div class="max-w-screen-xl mx-auto">

      <!-- Section label -->
      <span
        :class="['inline-block font-body uppercase mb-6', light ? 'text-primary/30' : 'text-white/30']"
        style="font-size: 0.6875rem; letter-spacing: 0.2em;"
        data-animate
      >{{ section.label }}</span>

      <!-- Headline + subtext -->
      <h2
        :class="['font-headline italic leading-[1.1] mb-4', light ? 'text-primary' : 'text-white']"
        style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.02em;"
        data-animate
      >{{ section.headline }}</h2>
      <p
        :class="['font-light max-w-2xl mb-14', light ? 'text-on-surface-variant' : 'text-white/60']"
        style="font-size: clamp(0.95rem, 2vw, 1.125rem); line-height: 1.8;"
        data-animate
      >{{ section.subtext }}</p>

      <!-- Bento grid -->
      <div :class="gridClass" data-animate>
        <div
          v-for="card in section.cards"
          :key="card.title"
          :class="[
            'rounded-2xl p-8 lg:p-10 transition-all duration-300',
            spanClass(card.span),
          ]"
          :style="{
            background: light ? 'rgba(23,48,40,0.04)' : 'rgba(255,255,255,0.05)',
            border: light ? '1px solid rgba(23,48,40,0.08)' : '1px solid rgba(255,255,255,0.06)',
          }"
        >
          <div :class="['flex gap-5', card.span === 'tall' ? 'flex-col items-center text-center h-full justify-center' : 'items-start']">
            <Icon
              v-if="card.icon"
              :icon="card.icon"
              :class="[
                'flex-shrink-0',
                light ? 'text-primary/30' : 'text-white/30',
                card.span === 'tall' ? 'text-4xl mb-2' : 'text-2xl mt-1',
              ]"
            />
            <div>
              <h3
                :class="['font-medium mb-2', light ? 'text-primary' : 'text-white', card.span === 'large' ? 'text-xl lg:text-2xl' : 'text-lg']"
              >{{ card.title }}</h3>
              <p :class="['font-light leading-relaxed', light ? 'text-on-surface-variant' : 'text-white/50']" style="font-size: 0.9375rem;">
                {{ card.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { JourneySection } from '~/utils/journey-data'

const props = defineProps<{
  section: JourneySection
  light?: boolean
}>()

const hasDynamicLayout = computed(() =>
  props.section.cards.some(c => c.span === 'tall' || c.span === 'large')
)

const gridClass = computed(() =>
  hasDynamicLayout.value
    ? 'grid grid-cols-1 md:grid-cols-3 md:grid-rows-[auto_auto] gap-4'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4'
)

function spanClass(span: string): string {
  switch (span) {
    case 'wide': return 'md:col-span-2'
    case 'tall': return 'md:row-span-2'
    case 'large': return 'md:col-span-2'
    default: return ''
  }
}
</script>
