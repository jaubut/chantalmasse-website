export function useBooking() {
  const isOpen = useState<boolean>('bookingOpen', () => false)

  const open = () => {
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  return {
    isOpen,
    open,
    close,
  }
}
