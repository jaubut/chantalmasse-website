<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-full"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-full"
  >
    <div
      v-if="visible"
      class="md:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-surface/90 backdrop-blur-md border-t border-outline-variant/40"
    >
      <button
        class="w-full bg-primary text-on-primary py-4 rounded-xl font-semibold text-base hover:bg-primary-container transition-colors"
        @click="handleClick"
      >
        {{ label }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { BookingServiceId } from '~/utils/bookingServices'

interface Props {
  label?: string
  serviceId?: BookingServiceId
  // Show only after the user has scrolled past this element's bottom.
  revealAfterSelector?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Prendre rendez-vous',
})

const booking = useBooking()
const visible = ref(false)

function handleClick() {
  booking.open(props.serviceId)
}

onMounted(() => {
  // If no reveal anchor, always visible on mobile.
  if (!props.revealAfterSelector) {
    visible.value = true
    return
  }

  const target = document.querySelector(props.revealAfterSelector)
  if (!target) {
    visible.value = true
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry) return
      // Reveal once the anchor element has scrolled out of view above the viewport.
      visible.value = entry.boundingClientRect.bottom < 0
    },
    { threshold: 0 },
  )
  observer.observe(target)

  onUnmounted(() => observer.disconnect())
})

// Hide the sticky bar when the booking modal is open so it doesn't overlap.
watch(() => booking.isOpen.value, (open) => {
  if (open) visible.value = false
  else if (!props.revealAfterSelector) visible.value = true
})
</script>
