declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
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

  function trackBookingComplete(service: string, value: number) {
    trackEvent('purchase', {
      currency: 'CAD',
      value,
      items: [{ item_name: service }],
    })
    // Meta uses 'Schedule' for appointment bookings
    if (window.fbq) {
      window.fbq('track', 'Schedule', { content_name: service, value, currency: 'CAD' })
    }
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
  }
}
