declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

// Pixel events accept a third arg `{ eventID }` that Meta uses to dedup
// against a server-side Conversions API event with the same id. We generate
// the id client-side and pass it through both paths so a single user action
// counts once even when both fire successfully.
function newEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for older browsers — collision risk is negligible at our volume.
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function useTracking() {
  function trackEvent(eventName: string, params?: Record<string, unknown>) {
    if (import.meta.server) return

    // GA4
    if (window.gtag) {
      window.gtag('event', eventName, params)
    }

    // Meta Pixel
    if (window.fbq) {
      window.fbq('track', eventName, params)
    }
  }

  // Returns the event_id used for the Pixel 'Schedule' call so the booking
  // POST can pass it to the server for CAPI dedup. Always returns a string,
  // even when fbq isn't loaded — caller still ships it to the server.
  function trackBookingComplete(service: string, value: number, eventId?: string): string {
    const id = eventId ?? newEventId()
    trackEvent('purchase', {
      currency: 'CAD',
      value,
      items: [{ item_name: service }],
    })
    // Meta uses 'Schedule' for appointment bookings. The third arg is the
    // dedup envelope — Pixel sends `event_id` to Meta so it can pair this
    // call with the matching server-side CAPI event.
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Schedule', { content_name: service, value, currency: 'CAD' }, { eventID: id })
    }
    return id
  }

  function trackContactSubmit() {
    trackEvent('generate_lead', { event_category: 'contact', event_label: 'contact_form' })
    if (window.fbq) {
      window.fbq('track', 'Contact')
    }
  }

  function trackBookingStart() {
    trackEvent('begin_checkout', { event_category: 'booking' })
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout')
    }
  }

  return {
    trackEvent,
    trackBookingComplete,
    trackContactSubmit,
    trackBookingStart,
    newEventId,
  }
}
