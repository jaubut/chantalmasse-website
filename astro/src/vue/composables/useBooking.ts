// Same API as composables/useBooking.ts, with module state instead of Nuxt's useState: every island on a page imports
// this one module, so the booking CTAs and <BookingModal> share it. Static markup opens it with data-booking-open.
import { ref } from 'vue'
import type { BookingServiceId } from '~/utils/bookingServices'

const isOpen = ref(false)
const preselectedServiceId = ref<BookingServiceId | null>(null)

const open = (serviceId?: BookingServiceId): void => {
  preselectedServiceId.value = serviceId ?? null
  isOpen.value = true
}

const close = (): void => {
  isOpen.value = false
  preselectedServiceId.value = null
}

export function useBooking() {
  return { isOpen, preselectedServiceId, open, close }
}
