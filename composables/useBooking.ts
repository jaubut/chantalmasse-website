import type { BookingServiceId } from '~/utils/bookingServices'

export function useBooking() {
  const isOpen = useState<boolean>('bookingOpen', () => false)
  const preselectedServiceId = useState<BookingServiceId | null>('bookingPreselectedService', () => null)

  const open = (serviceId?: BookingServiceId) => {
    preselectedServiceId.value = serviceId ?? null
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
    preselectedServiceId.value = null
  }

  return {
    isOpen,
    preselectedServiceId,
    open,
    close,
  }
}
