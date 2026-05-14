import posthog from 'posthog-js'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

// Mirror an event into PostHog. Silently no-ops when PostHog isn't loaded
// (missing key, SSR context, before plugin init). Kept as a thin wrapper so
// the existing GA4/Meta call sites don't have to know PostHog exists.
function capturePosthog(eventName: string, props?: Record<string, unknown>): void {
  if (import.meta.server) return
  try {
    posthog.capture(eventName, props)
  } catch {
    // posthog not initialized — silent.
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

    // PostHog — same name + params. PostHog also receives a richer set of
    // named events directly from the helpers below.
    capturePosthog(eventName, params)
  }

  // Returns the event_id used for the Pixel 'Schedule' call so the booking
  // POST can pass it to the server for CAPI dedup. Always returns a string,
  // even when fbq isn't loaded — caller still ships it to the server.
  //
  // GA4 event is `generate_lead` (not `purchase`) — this is a lead-gen
  // business, not e-commerce. The active Google Ads conversion action
  // ("Envoi de formulaire pour prospects", category SUBMIT_LEAD_FORM) is
  // imported from GA4's `generate_lead` event, so firing `purchase` here
  // means Smart Bidding gets zero signal even when bookings complete.
  function trackBookingComplete(service: string, value: number, eventId?: string): string {
    const id = eventId ?? newEventId()
    trackEvent('generate_lead', {
      currency: 'CAD',
      value,
      event_category: 'booking',
      event_label: service,
    })
    // Meta uses 'Schedule' for appointment bookings. The third arg is the
    // dedup envelope — Pixel sends `event_id` to Meta so it can pair this
    // call with the matching server-side CAPI event.
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Schedule', { content_name: service, value, currency: 'CAD' }, { eventID: id })
    }
    // PostHog — dedicated funnel-friendly event name. trackEvent above also
    // fires `generate_lead` into PostHog; this gives a cleaner, business-named
    // event to anchor funnels on.
    capturePosthog('booking_completed', {
      service,
      value,
      currency: 'CAD',
    })
    return id
  }

  function trackContactSubmit() {
    trackEvent('generate_lead', { event_category: 'contact', event_label: 'contact_form' })
    if (window.fbq) {
      window.fbq('track', 'Contact')
    }
    capturePosthog('contact_submitted', { source: 'contact_modal' })
  }

  function trackBookingStart() {
    trackEvent('begin_checkout', { event_category: 'booking' })
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout')
    }
    capturePosthog('booking_started', { stage: 'first_interaction' })
  }

  // Fired when the booking modal first opens (before the user does anything
  // inside it). Distinct from booking_started, which fires on first form
  // interaction. Lets us measure "opened but bounced" separately from
  // "engaged but didn't finish".
  function trackBookingModalOpened(source: string, serviceId?: string | null) {
    capturePosthog('booking_modal_opened', {
      source,
      service_id: serviceId ?? null,
      page: typeof window !== 'undefined' ? window.location.pathname : null,
    })
  }

  return {
    trackEvent,
    trackBookingComplete,
    trackContactSubmit,
    trackBookingStart,
    trackBookingModalOpened,
    newEventId,
  }
}
