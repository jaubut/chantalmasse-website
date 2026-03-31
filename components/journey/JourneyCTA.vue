<template>
  <div class="absolute bottom-16 left-0 right-0 flex justify-center z-20">
    <Transition name="journey-cta">
      <button
        v-if="visible"
        class="nav-clay text-white px-10 py-5 rounded-xl text-lg"
        style="font-size: clamp(0.95rem, 2vw, 1.125rem);"
        :aria-label="journeyCTA.ariaLabel"
        @click="booking.open()"
      >
        {{ journeyCTA.label }}
      </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { journeyCTA } from '~/utils/journey-data'

defineProps<{
  visible: boolean
}>()

const booking = useBooking()
</script>
