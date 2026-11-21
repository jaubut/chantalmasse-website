// Same API as composables/useContact.ts, with module state shared by every island (see useBooking.ts).
// Static markup opens it with data-contact-open.
import { ref } from 'vue'

const isOpen = ref(false)

export function useContact() {
  return {
    isOpen,
    open: (): void => { isOpen.value = true },
    close: (): void => { isOpen.value = false },
  }
}
