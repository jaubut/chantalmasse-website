<template>
  <div class="px-4">
    <!-- Recap card -->
    <div class="bg-primary-fixed rounded-xl p-4 mb-8 font-body text-sm">
      <div class="grid grid-cols-2 gap-x-6 gap-y-1.5">
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Service</span>
          <p class="font-semibold text-on-surface">{{ service.name }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Durée</span>
          <p class="font-semibold text-on-surface">{{ service.duration }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Tarif</span>
          <p class="font-semibold text-on-surface">{{ service.price }}&nbsp;$</p>
        </div>
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Date</span>
          <p class="font-semibold text-on-surface capitalize">{{ formattedDate }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant text-xs uppercase tracking-wide">Heure</span>
          <p class="font-semibold text-on-surface">{{ slot.label }}</p>
        </div>
      </div>
    </div>

    <!-- Pre-filled notice -->
    <div v-if="prefilled" class="flex items-center justify-between bg-primary-fixed/60 rounded-xl px-4 py-3 mb-2 font-body text-sm">
      <span class="text-on-surface">👋 Vos informations ont été pré-remplies.</span>
      <button type="button" class="text-on-surface-variant underline text-xs hover:text-on-surface transition-colors" @click="clearSaved">
        Effacer
      </button>
    </div>

    <!-- Form -->
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Name row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="font-body text-sm font-semibold text-on-surface block mb-2">Prénom *</label>
          <input
            v-model="form.firstName"
            type="text"
            required
            autocomplete="given-name"
            maxlength="80"
            placeholder="Marie"
            class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-5 py-4 font-body text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
            :class="errors.firstName ? 'border-red-400 ring-1 ring-red-400' : ''"
          />
          <p v-if="errors.firstName" class="mt-1.5 text-xs font-body text-red-500">{{ errors.firstName }}</p>
        </div>
        <div>
          <label class="font-body text-sm font-semibold text-on-surface block mb-2">Nom *</label>
          <input
            v-model="form.lastName"
            type="text"
            required
            autocomplete="family-name"
            maxlength="80"
            placeholder="Tremblay"
            class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-5 py-4 font-body text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
            :class="errors.lastName ? 'border-red-400 ring-1 ring-red-400' : ''"
          />
          <p v-if="errors.lastName" class="mt-1.5 text-xs font-body text-red-500">{{ errors.lastName }}</p>
        </div>
      </div>

      <!-- Email -->
      <div>
        <label class="font-body text-sm font-semibold text-on-surface block mb-2">Courriel *</label>
        <input
          v-model="form.email"
          type="email"
          required
          autocomplete="email"
          maxlength="254"
          placeholder="marie@exemple.com"
          class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-5 py-4 font-body text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
          :class="errors.email ? 'border-red-400 ring-1 ring-red-400' : ''"
        />
        <p v-if="errors.email" class="mt-1.5 text-xs font-body text-red-500">{{ errors.email }}</p>
      </div>

      <!-- Phone -->
      <div>
        <label class="font-body text-sm font-semibold text-on-surface block mb-2">
          Téléphone
          <span class="font-normal text-on-surface-variant">{{ form.smsConsent ? '*' : '(optionnel)' }}</span>
        </label>
        <input
          v-model="form.phone"
          type="tel"
          autocomplete="tel"
          maxlength="32"
          placeholder="450 123-4567"
          class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-5 py-4 font-body text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
          :class="errors.phone ? 'border-red-400 ring-1 ring-red-400' : ''"
        />
        <p v-if="errors.phone" class="mt-1.5 text-xs font-body text-red-500">{{ errors.phone }}</p>

        <!-- SMS consent -->
        <label class="flex items-start gap-3 cursor-pointer group mt-4 py-2 min-h-11">
          <div class="relative mt-0.5">
            <input
              v-model="form.smsConsent"
              type="checkbox"
              class="w-5 h-5 rounded accent-primary cursor-pointer"
            />
          </div>
          <span class="font-body text-sm text-on-surface-variant leading-relaxed">
            Recevoir une confirmation par SMS et un rappel 24h avant la séance.
          </span>
        </label>
      </div>

      <!-- Session type -->
      <div>
        <label class="font-body text-sm font-semibold text-on-surface block mb-3">Type de séance *</label>
        <!-- Coaching de couple is in-person only at Shefford. -->
        <div v-if="isCoupleService" class="bg-surface-container-low border border-outline-variant/30 rounded-xl px-5 py-4">
          <p class="font-body text-sm text-on-surface">📍 En personne — Shefford</p>
          <p class="font-body text-xs text-on-surface-variant mt-1">Le coaching de couple se fait uniquement en présentiel.</p>
        </div>
        <div v-else class="flex flex-col sm:flex-row gap-3">
          <label
            class="flex-1 flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200"
            :class="form.sessionType === 'in-person' ? 'bg-primary-fixed border-primary' : 'bg-surface-container-low border-outline-variant/30 hover:border-primary/40'"
          >
            <input
              v-model="form.sessionType"
              type="radio"
              value="in-person"
              class="accent-primary"
            />
            <span class="font-body text-sm text-on-surface">📍 En personne (Shefford)</span>
          </label>
          <label
            class="flex-1 flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200"
            :class="form.sessionType === 'video' ? 'bg-primary-fixed border-primary' : 'bg-surface-container-low border-outline-variant/30 hover:border-primary/40'"
          >
            <input
              v-model="form.sessionType"
              type="radio"
              value="video"
              class="accent-primary"
            />
            <span class="font-body text-sm text-on-surface">📹 En visioconférence</span>
          </label>
        </div>
        <p v-if="errors.sessionType" class="mt-1.5 text-xs font-body text-red-500">{{ errors.sessionType }}</p>
      </div>

      <!-- Message -->
      <div>
        <label class="font-body text-sm font-semibold text-on-surface block mb-2">
          Message
          <span class="font-normal text-on-surface-variant">(optionnel)</span>
        </label>
        <textarea
          v-model="form.message"
          rows="3"
          maxlength="1200"
          placeholder="Ce que vous souhaitez aborder..."
          class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-5 py-4 font-body text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200 resize-none"
        />
      </div>

      <!-- Privacy checkbox -->
      <label class="flex items-start gap-3 cursor-pointer group py-2 min-h-11">
        <div class="relative mt-0.5">
          <input
            v-model="form.privacy"
            type="checkbox"
            required
            class="w-5 h-5 rounded accent-primary cursor-pointer"
          />
        </div>
        <span class="font-body text-sm text-on-surface-variant leading-relaxed">
          J'accepte la
          <NuxtLink to="/confidentialite" class="text-primary underline hover:opacity-70 transition-opacity">politique de confidentialité</NuxtLink>
          *
        </span>
      </label>
      <p v-if="errors.privacy" class="mt-1.5 text-xs font-body text-red-500">{{ errors.privacy }}</p>

      <!-- Error from API -->
      <div v-if="apiError" class="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
        <p class="font-body text-sm text-red-600">{{ apiError }}</p>
      </div>

      <!-- Submit -->
      <button
        type="submit"
        :disabled="isLoading"
        class="w-full bg-primary text-on-primary py-5 rounded-xl font-body font-semibold text-lg hover:opacity-90 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-3"
      >
        <span v-if="isLoading" class="flex items-center gap-3">
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Réservation en cours...
        </span>
        <span v-else>Confirmer ma réservation →</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { BookingService } from './ServiceSelector.vue'
import type { TimeSlot } from '~/utils/bookingHelpers'

const STORAGE_KEY = 'booking_client_info'

const props = defineProps<{
  service: BookingService
  date: Date
  slot: TimeSlot
  isLoading: boolean
  apiError: string | null
}>()

const emit = defineEmits<{
  submit: [formData: FormData]
}>()

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  sessionType: 'in-person' | 'video'
  message: string
  privacy: boolean
  smsConsent: boolean
}

const form = reactive<FormData>({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  sessionType: 'in-person',
  message: '',
  privacy: false,
  smsConsent: false,
})

const errors = reactive<Partial<Record<keyof FormData, string>>>({})
const prefilled = ref(false)

// Coaching de couple is in-person only — lock sessionType when this is the
// active service so the form can never submit "video" for couple.
const isCoupleService = computed(() => props.service?.id === 'couple')
watchEffect(() => {
  if (isCoupleService.value && form.sessionType !== 'in-person') {
    form.sessionType = 'in-person'
  }
})

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { firstName, lastName, email, phone } = JSON.parse(saved)
      if (firstName) { form.firstName = firstName; prefilled.value = true }
      if (lastName) form.lastName = lastName
      if (email) form.email = email
      if (phone) form.phone = phone
    }
  } catch {}
})

function clearSaved() {
  localStorage.removeItem(STORAGE_KEY)
  form.firstName = ''
  form.lastName = ''
  form.email = ''
  form.phone = ''
  prefilled.value = false
}

const formattedDate = computed(() =>
  format(props.date, "d MMMM yyyy", { locale: fr }),
)

function validate(): boolean {
  Object.keys(errors).forEach((k) => delete (errors as any)[k])

  if (!form.firstName.trim()) errors.firstName = 'Le prénom est requis'
  if (!form.lastName.trim()) errors.lastName = 'Le nom est requis'
  if (!form.email.trim()) {
    errors.email = 'Le courriel est requis'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Adresse courriel invalide'
  }
  if (form.smsConsent) {
    const digits = form.phone.replace(/\D/g, '')
    if (!form.phone.trim()) {
      errors.phone = 'Un numéro est requis pour les rappels SMS'
    } else if (digits.length < 10) {
      errors.phone = 'Numéro de téléphone invalide'
    }
  }
  if (!form.sessionType) errors.sessionType = 'Veuillez choisir un type de séance'
  if (!form.privacy) errors.privacy = 'Vous devez accepter la politique de confidentialité'

  return Object.keys(errors).length === 0
}

function handleSubmit() {
  if (!validate()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
    }))
  } catch {}
  emit('submit', { ...form })
}
</script>
