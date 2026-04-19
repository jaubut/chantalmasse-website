<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="closeModal"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-[#1d1b19]/60 backdrop-blur-sm" @click="closeModal" />

        <!-- Card -->
        <div
          class="relative z-10 w-full max-w-3xl max-h-[90vh] bg-surface rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          :aria-label="stepTitle"
        >
          <!-- Top bar -->
          <div class="flex items-center justify-between px-8 pt-8 pb-0 shrink-0">
            <!-- Back button -->
            <button
              v-if="canGoBack"
              class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container transition-colors text-on-surface-variant"
              aria-label="Retour"
              @click="goBack"
            >
              <Icon icon="material-symbols:arrow-back" class="text-lg" />
            </button>
            <div v-else class="w-9" />

            <!-- Step dots -->
            <div class="flex items-center gap-2">
              <div
                v-for="n in 4"
                :key="n"
                class="rounded-full transition-all duration-300"
                :class="
                  n === stepDotActive
                    ? 'w-6 h-2 bg-primary'
                    : n < stepDotActive
                    ? 'w-2 h-2 bg-primary/40'
                    : 'w-2 h-2 bg-surface-container-high'
                "
              />
            </div>

            <!-- Close button -->
            <button
              class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container transition-colors text-on-surface-variant text-xl leading-none"
              aria-label="Fermer"
              @click="closeModal"
            >
              <Icon icon="material-symbols:close" class="text-lg" />
            </button>
          </div>

          <!-- Error banner -->
          <div
            v-if="globalError"
            class="mx-8 mt-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3 shrink-0"
          >
            <p class="font-body text-sm text-red-600">{{ globalError }}</p>
            <button class="text-xs text-red-500 underline mt-1" @click="globalError = null">Fermer</button>
          </div>

          <!-- Step content (scrollable) -->
          <div class="overflow-y-auto flex-1 px-8 pt-8 pb-8">
            <Transition :name="transitionName" mode="out-in">
              <!-- Step 1: Service selection -->
              <BookingServiceSelector
                v-if="currentStep === 'service'"
                key="service"
                @select="onServiceSelected"
              />

              <!-- Step 2: Calendar -->
              <BookingMonthCalendar
                v-else-if="currentStep === 'calendar'"
                key="calendar"
                :service="selectedService!"
                :selected-date="selectedDate"
                @select="onDateSelected"
              />

              <!-- Step 3: Time slots -->
              <BookingTimeSlotPicker
                v-else-if="currentStep === 'time'"
                key="time"
                :date="selectedDate!"
                :service="selectedService!"
                :slots="slotsForSelectedDate"
                :selected-slot="selectedSlot"
                :is-loading="isLoadingSlots"
                @select="onSlotSelected"
                @back="currentStep = 'calendar'"
              />

              <!-- Step 4: Intake form -->
              <BookingIntakeForm
                v-else-if="currentStep === 'form'"
                key="form"
                :service="selectedService!"
                :date="selectedDate!"
                :slot="selectedSlot!"
                :is-loading="isSubmitting"
                :api-error="submitError"
                @submit="onFormSubmit"
              />

              <!-- Step 5: Confirmation -->
              <BookingConfirmationView
                v-else-if="currentStep === 'confirmation'"
                key="confirmation"
                :booking="bookingResult!"
                :service="selectedService!"
                :first-name="confirmedFirstName"
                @close="closeModal"
              />
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useBooking } from '~/composables/useBooking'
import type { BookingService } from './ServiceSelector.vue'
import { getBookingService } from '~/utils/bookingServices'
import type { TimeSlot } from '~/utils/bookingHelpers'

type Step = 'service' | 'calendar' | 'time' | 'form' | 'confirmation'

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

const { isOpen, close, preselectedServiceId } = useBooking()
const { trackBookingStart, trackBookingComplete } = useTracking()

const currentStep = ref<Step>('service')
const transitionName = ref('slide-forward')

const selectedService = ref<BookingService | null>(null)
const selectedDate = ref<Date | null>(null)
const selectedSlot = ref<TimeSlot | null>(null)
const slotsForSelectedDate = ref<TimeSlot[]>([])

const isLoadingSlots = ref(false)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const globalError = ref<string | null>(null)
const bookingResult = ref<BookingResult | null>(null)
const confirmedFirstName = ref('')

const stepOrder: Step[] = ['service', 'calendar', 'time', 'form', 'confirmation']

const stepDotActive = computed(() => {
  const map: Record<Step, number> = {
    service: 1,
    calendar: 2,
    time: 3,
    form: 4,
    confirmation: 4,
  }
  return map[currentStep.value]
})

const stepTitle = computed(() => {
  const titles: Record<Step, string> = {
    service: 'Choisir un service',
    calendar: 'Choisir une date',
    time: 'Choisir un horaire',
    form: 'Informations personnelles',
    confirmation: 'Réservation confirmée',
  }
  return titles[currentStep.value]
})

const canGoBack = computed(() => {
  return ['calendar', 'time', 'form'].includes(currentStep.value)
})

function goBack() {
  transitionName.value = 'slide-back'
  const idx = stepOrder.indexOf(currentStep.value)
  if (idx > 0) currentStep.value = stepOrder[idx - 1]
}

function advance(step: Step) {
  transitionName.value = 'slide-forward'
  currentStep.value = step
}

function onServiceSelected(service: BookingService) {
  selectedService.value = service
  selectedDate.value = null
  selectedSlot.value = null
  advance('calendar')
}

function onDateSelected(date: Date) {
  selectedDate.value = date
  // Fetch slots for this date
  fetchSlotsForDate(date)
  advance('time')
}

async function fetchSlotsForDate(date: Date) {
  if (!selectedService.value) return
  isLoadingSlots.value = true
  slotsForSelectedDate.value = []
  const month = format(date, 'yyyy-MM')
  try {
    const data = await $fetch<{ slotsByDate: Record<string, TimeSlot[]> }>(
      '/api/booking/availability',
      { params: { month, service: selectedService.value.id } },
    )
    const dateKey = format(date, 'yyyy-MM-dd')
    slotsForSelectedDate.value = data.slotsByDate[dateKey] || []
  } catch {
    slotsForSelectedDate.value = []
    globalError.value = 'Impossible de charger les disponibilités. Veuillez réessayer.'
  } finally {
    isLoadingSlots.value = false
  }
}

function onSlotSelected(slot: TimeSlot) {
  selectedSlot.value = slot
  advance('form')
}

async function onFormSubmit(formData: {
  firstName: string
  lastName: string
  email: string
  phone: string
  sessionType: 'in-person' | 'video'
  message: string
}) {
  if (!selectedService.value || !selectedSlot.value) return

  isSubmitting.value = true
  submitError.value = null

  try {
    const result = await $fetch<{
      success: boolean
      eventId: string
      meetLink?: string | null
      cancelToken: string
      dateFormatted: string
      timeFormatted: string
    }>('/api/booking/create', {
      method: 'POST',
      body: {
        serviceId: selectedService.value.id,
        isoStart: selectedSlot.value.isoStart,
        isoEnd: selectedSlot.value.isoEnd,
        sessionType: formData.sessionType,
        client: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          message: formData.message || undefined,
        },
      },
    })

    confirmedFirstName.value = formData.firstName
    bookingResult.value = {
      service: selectedService.value.name,
      date: result.dateFormatted,
      time: result.timeFormatted,
      sessionType: formData.sessionType,
      meetLink: result.meetLink,
      isoStart: selectedSlot.value.isoStart,
      isoEnd: selectedSlot.value.isoEnd,
      eventId: result.eventId,
    }

    trackBookingComplete(selectedService.value.name, selectedService.value.price)
    advance('confirmation')
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Une erreur est survenue. Veuillez réessayer.'
    if (err?.status === 409) {
      submitError.value = msg
    } else {
      submitError.value = msg
    }
  } finally {
    isSubmitting.value = false
  }
}

function closeModal() {
  close()
}

// Reset state when modal opens
watch(isOpen, (val) => {
  if (val) {
    trackBookingStart()
    selectedDate.value = null
    selectedSlot.value = null
    slotsForSelectedDate.value = []
    bookingResult.value = null
    submitError.value = null
    globalError.value = null
    confirmedFirstName.value = ''
    transitionName.value = 'slide-forward'

    // If the caller pre-selected a service (e.g. from the LP's service switcher),
    // skip the service-picker step and jump straight to the calendar.
    const preselected = getBookingService(preselectedServiceId.value)
    if (preselected) {
      selectedService.value = preselected
      currentStep.value = 'calendar'
    } else {
      selectedService.value = null
      currentStep.value = 'service'
    }
  }
})
</script>

<style scoped>
/* Modal fade+scale enter/leave */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease-out;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: scale(0.96);
}
.modal-leave-to .relative {
  transform: scale(0.96);
}

/* Step transitions — forward */
.slide-forward-enter-active,
.slide-forward-leave-active {
  transition: opacity 0.22s ease-out, transform 0.22s ease-out;
}
.slide-forward-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.slide-forward-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

/* Step transitions — back */
.slide-back-enter-active,
.slide-back-leave-active {
  transition: opacity 0.22s ease-out, transform 0.22s ease-out;
}
.slide-back-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}
.slide-back-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
