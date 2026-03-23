<template>
  <div class="px-2">
    <!-- Header -->
    <div class="mb-6">
      <h3 class="font-headline text-2xl italic text-primary mb-1 capitalize">
        {{ formattedDate }}
      </h3>
      <div class="flex items-center gap-3">
        <span class="font-body text-on-surface-variant text-sm">{{ service.name }}</span>
        <span class="text-xs font-body font-semibold bg-primary text-on-primary px-3 py-1 rounded-full">
          {{ service.duration }}
        </span>
      </div>
    </div>

    <!-- Slots grid -->
    <div v-if="slots.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        v-for="slot in slots"
        :key="slot.isoStart"
        class="group relative text-left p-4 rounded-xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="
          isSelected(slot)
            ? 'bg-primary text-on-primary border-primary'
            : 'bg-surface-container-low border-outline-variant/30 hover:bg-primary-fixed hover:border-primary'
        "
        @click="$emit('select', slot)"
      >
        <span class="font-body font-semibold text-base block mb-2">
          {{ slot.label }}
        </span>
        <div class="flex flex-wrap gap-2">
          <span
            v-if="service.id === 'individual'"
            class="inline-flex items-center gap-1.5 text-xs font-body px-2.5 py-1 rounded-full transition-colors"
            :class="isSelected(slot) ? 'bg-on-primary/10 text-on-primary' : 'bg-[#e0f5ed] text-[#1a6e4a]'"
          >
            📹 Visio disponible
          </span>
          <span
            class="inline-flex items-center gap-1.5 text-xs font-body px-2.5 py-1 rounded-full transition-colors"
            :class="isSelected(slot) ? 'bg-on-primary/10 text-on-primary' : 'bg-primary-fixed text-primary'"
          >
            📍 Shefford disponible
          </span>
        </div>
      </button>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <div class="text-4xl mb-4">📅</div>
      <p class="font-body text-on-surface-variant mb-6">
        Aucune disponibilité ce jour. Veuillez choisir une autre date.
      </p>
      <button
        class="font-body font-semibold text-primary hover:opacity-70 transition-opacity flex items-center gap-2 mx-auto"
        @click="$emit('back')"
      >
        <Icon icon="material-symbols:arrow-back" class="text-base" />
        Choisir une autre date
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { BookingService } from './ServiceSelector.vue'
import type { TimeSlot } from '~/utils/bookingHelpers'

const props = defineProps<{
  date: Date
  service: BookingService
  slots: TimeSlot[]
  selectedSlot: TimeSlot | null
}>()

defineEmits<{
  select: [slot: TimeSlot]
  back: []
}>()

const formattedDate = computed(() =>
  format(props.date, "EEEE d MMMM yyyy", { locale: fr }),
)

function isSelected(slot: TimeSlot): boolean {
  return props.selectedSlot?.isoStart === slot.isoStart
}
</script>
