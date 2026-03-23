<template>
  <div class="px-2 text-center">
    <!-- Animated checkmark -->
    <div class="flex justify-center mb-6">
      <div class="w-20 h-20 rounded-full bg-[#e8f8f2] flex items-center justify-center check-appear">
        <svg class="w-10 h-10 text-[#3D9970]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>

    <h2 class="font-headline text-4xl italic text-primary mb-2">
      Votre séance est confirmée!
    </h2>
    <p class="font-body text-on-surface-variant mb-8">
      Merci {{ firstName }}, nous vous attendons avec plaisir.
    </p>

    <!-- Booking recap -->
    <div class="bg-surface-container-low rounded-[1.5rem] p-6 mb-6 text-left">
      <div class="grid grid-cols-2 gap-x-6 gap-y-3 font-body text-sm">
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Service</span>
          <p class="font-semibold text-on-surface mt-0.5">{{ booking.service }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Date</span>
          <p class="font-semibold text-on-surface mt-0.5 capitalize">{{ booking.date }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Heure</span>
          <p class="font-semibold text-on-surface mt-0.5">{{ booking.time }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Format</span>
          <p class="font-semibold text-on-surface mt-0.5">
            {{ booking.sessionType === 'video' ? 'En visioconférence' : 'En personne — Shefford' }}
          </p>
        </div>
      </div>

      <!-- Meet link -->
      <div v-if="booking.meetLink" class="mt-5 pt-5 border-t border-outline-variant/20">
        <a
          :href="booking.meetLink"
          target="_blank"
          rel="noopener"
          class="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3.5 rounded-xl font-body font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Icon icon="material-symbols:videocam" />
          Rejoindre la séance →
        </a>
      </div>
    </div>

    <!-- Info box -->
    <div class="bg-primary-fixed rounded-[1.5rem] p-6 mb-6 text-left">
      <div class="space-y-3 font-body text-sm text-on-surface">
        <div class="flex items-start gap-3">
          <span class="text-lg">📧</span>
          <span>Un courriel de confirmation vous a été envoyé</span>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-lg">📅</span>
          <span>Ajoutez l'événement à votre calendrier</span>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-lg">⏰</span>
          <span>Vous recevrez un rappel 24h avant votre séance</span>
        </div>
      </div>
    </div>

    <!-- Add to calendar buttons -->
    <div class="flex flex-col sm:flex-row gap-3 mb-8">
      <a
        :href="googleCalUrl"
        target="_blank"
        rel="noopener"
        class="flex-1 flex items-center justify-center gap-2 bg-surface-container border border-outline-variant/30 text-on-surface py-3.5 rounded-xl font-body font-medium text-sm hover:bg-surface-container-high transition-colors"
      >
        <Icon icon="material-symbols:calendar-add-on" class="text-base" />
        + Google Agenda
      </a>
      <button
        class="flex-1 flex items-center justify-center gap-2 bg-surface-container border border-outline-variant/30 text-on-surface py-3.5 rounded-xl font-body font-medium text-sm hover:bg-surface-container-high transition-colors"
        @click="downloadICS"
      >
        <Icon icon="material-symbols:calendar-today" class="text-base" />
        + iCal / Apple
      </button>
    </div>

    <!-- Close button -->
    <button
      class="w-full border border-outline-variant/40 text-on-surface-variant py-4 rounded-xl font-body font-medium hover:bg-surface-container transition-colors"
      @click="$emit('close')"
    >
      Fermer
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { googleCalendarUrl, generateICS } from '~/utils/bookingHelpers'
import type { BookingService } from './ServiceSelector.vue'

interface BookingResult {
  service: string
  date: string
  time: string
  sessionType: 'in-person' | 'video'
  meetLink?: string | null
  isoStart: string
  isoEnd: string
  eventId: string
}

const props = defineProps<{
  booking: BookingResult
  service: BookingService
  firstName: string
}>()

defineEmits<{
  close: []
}>()

const locationLabel = computed(() =>
  props.booking.sessionType === 'video'
    ? 'En visioconférence (Google Meet)'
    : 'En personne — Shefford, QC',
)

const googleCalUrl = computed(() =>
  googleCalendarUrl({
    title: `Séance — ${props.service.name}`,
    start: props.booking.isoStart,
    end: props.booking.isoEnd,
    description: props.booking.meetLink
      ? `Rejoindre la séance: ${props.booking.meetLink}`
      : '',
    location: props.booking.sessionType === 'in-person' ? 'Shefford, QC' : undefined,
  }),
)

function downloadICS() {
  const icsContent = generateICS({
    title: `Séance — ${props.service.name}`,
    start: props.booking.isoStart,
    end: props.booking.isoEnd,
    description: [
      `Service: ${props.service.name}`,
      `Format: ${locationLabel.value}`,
      props.booking.meetLink ? `Lien: ${props.booking.meetLink}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: props.booking.sessionType === 'in-person' ? 'Shefford, QC' : undefined,
    uid: props.booking.eventId,
  })

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'seance-chantal-masse.ics'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.check-appear {
  animation: checkAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes checkAppear {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
