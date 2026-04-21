<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6 py-16">
    <div class="w-full max-w-lg">

      <!-- Loading -->
      <div v-if="state === 'loading'" class="text-center">
        <div class="w-12 h-12 mx-auto mb-6 relative">
          <svg class="animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75 text-primary" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p class="text-on-surface-variant font-light">Chargement de votre rendez-vous...</p>
      </div>

      <!-- Invalid / expired token -->
      <div v-else-if="state === 'invalid'" class="text-center">
        <div class="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mx-auto mb-8">
          <Icon icon="material-symbols:link-off" class="text-3xl text-on-error-container" />
        </div>
        <h1 class="font-headline italic text-4xl text-primary mb-4">Lien invalide</h1>
        <p class="text-on-surface-variant font-light leading-relaxed mb-8">
          {{ errorMessage || 'Ce lien n\'est plus valide. Le rendez-vous a peut-être déjà été annulé ou est passé.' }}
        </p>
        <NuxtLink to="/prendre-rendez-vous" class="inline-block bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity">
          Prendre un nouveau rendez-vous
        </NuxtLink>
      </div>

      <!-- Confirm cancellation -->
      <div v-else-if="state === 'confirm'">
        <div class="text-center mb-8">
          <h1 class="font-headline italic text-4xl text-primary mb-3">Annuler votre séance</h1>
          <p class="text-on-surface-variant font-light">
            Voulez-vous annuler le rendez-vous suivant&nbsp;?
          </p>
        </div>

        <div class="bg-surface-container-low border border-outline-variant rounded-2xl p-6 mb-8">
          <div class="space-y-3 font-body text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-on-surface-variant shrink-0">Service</span>
              <span class="font-semibold text-on-surface text-right min-w-0 break-words">{{ booking?.service }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-on-surface-variant shrink-0">Date</span>
              <span class="font-semibold text-on-surface text-right capitalize min-w-0 break-words">{{ booking?.date }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-on-surface-variant shrink-0">Heure</span>
              <span class="font-semibold text-on-surface text-right min-w-0 break-words">{{ booking?.time }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-on-surface-variant shrink-0">Format</span>
              <span class="font-semibold text-on-surface text-right min-w-0 break-words">
                {{ booking?.sessionType === 'video' ? 'Visioconférence' : 'En personne — Shefford' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="apiError" class="bg-error-container/40 border border-error/30 rounded-xl px-5 py-4 mb-6">
          <p class="font-body text-sm text-on-error-container">{{ apiError }}</p>
        </div>

        <div class="flex flex-col sm:flex-row gap-4 sm:gap-3">
          <button
            type="button"
            :disabled="isSubmitting"
            class="flex-1 bg-error text-on-error py-4 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 min-h-11"
            @click="handleCancel"
          >
            <svg v-if="isSubmitting" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ isSubmitting ? 'Annulation en cours...' : 'Oui, annuler' }}
          </button>
          <NuxtLink
            to="/"
            class="flex-1 flex items-center justify-center bg-surface-container-low border border-outline-variant text-on-surface py-4 rounded-xl font-semibold hover:bg-surface-container transition-colors text-center min-h-11"
          >
            Garder le rendez-vous
          </NuxtLink>
        </div>
      </div>

      <!-- Done -->
      <div v-else-if="state === 'done'" class="text-center">
        <div class="w-16 h-16 rounded-full bg-secondary-fixed flex items-center justify-center mx-auto mb-8">
          <Icon icon="material-symbols:check" class="text-3xl text-on-secondary-container" />
        </div>
        <h1 class="font-headline italic text-4xl text-primary mb-4">Rendez-vous annulé</h1>
        <p class="text-on-surface-variant font-light leading-relaxed mb-8">
          Votre séance du <span class="font-semibold text-on-surface capitalize">{{ booking?.date }}</span> à <span class="font-semibold text-on-surface">{{ booking?.time }}</span> a été retirée du calendrier. Un courriel de confirmation vient de vous être envoyé.
        </p>
        <NuxtLink to="/prendre-rendez-vous" class="inline-block bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity">
          Prendre un nouveau rendez-vous
        </NuxtLink>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'

type BookingInfo = {
  firstName: string
  service: string
  sessionType: 'in-person' | 'video'
  date: string
  time: string
  startISO: string
}

type State = 'loading' | 'confirm' | 'invalid' | 'done'

const route = useRoute()
const token = ref<string>('')
const state = ref<State>('loading')
const booking = ref<BookingInfo | null>(null)
const errorMessage = ref<string>('')
const apiError = ref<string>('')
const isSubmitting = ref(false)

useSeoMeta({
  title: 'Annuler votre rendez-vous — Chantal Massé',
  robots: 'noindex, nofollow',
})

useHead({
  link: [{ rel: 'canonical', href: 'https://chantalmasse.com/annuler' }],
})

onMounted(async () => {
  const raw = route.query.token
  const t = Array.isArray(raw) ? raw[0] : raw
  if (!t || typeof t !== 'string') {
    state.value = 'invalid'
    errorMessage.value = 'Aucun lien d\'annulation fourni.'
    return
  }
  token.value = t

  try {
    const data = await $fetch<BookingInfo>('/api/booking/cancel-info', {
      params: { token: t },
    })
    booking.value = data
    state.value = 'confirm'
  } catch (err: any) {
    state.value = 'invalid'
    errorMessage.value = err?.data?.message || err?.message || 'Ce lien n\'est plus valide.'
  }
})

async function handleCancel() {
  if (!token.value) return
  apiError.value = ''
  isSubmitting.value = true
  try {
    await $fetch('/api/booking/cancel', {
      method: 'POST',
      body: { token: token.value },
    })
    state.value = 'done'
  } catch (err: any) {
    apiError.value = err?.data?.message || err?.message || 'Impossible d\'annuler le rendez-vous.'
  } finally {
    isSubmitting.value = false
  }
}
</script>
