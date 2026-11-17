import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import posthog from 'posthog-js'
import { useTracking } from '~/composables/useTracking'

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }))

const gtag = vi.fn()
const fbq = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { gtag, fbq, location: { pathname: '/prendre-rendez-vous/' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('confirmed booking tracking', () => {
  it('separates the booking conversion from contact leads and preserves Meta dedup', () => {
    const id = useTracking().trackBookingComplete('Thérapie Individuelle', 105, 'meta-request-id', 'calendar-event-id')

    expect(id).toBe('meta-request-id')
    expect(gtag.mock.calls).toEqual([
      ['event', 'booking_confirmed', { currency: 'CAD', value: 105, event_category: 'booking', event_label: 'Thérapie Individuelle' }],
      ['event', 'conversion', { send_to: 'AW-16485477025/IFK1CJuhqrodEKHV8bQ9', transaction_id: 'calendar-event-id', currency: 'CAD', value: 105 }],
    ])
    expect(fbq).toHaveBeenCalledWith('track', 'Schedule', { content_name: 'Thérapie Individuelle', value: 105, currency: 'CAD' }, { eventID: 'meta-request-id' })
    expect(posthog.capture).toHaveBeenCalledWith('booking_completed', { service: 'Thérapie Individuelle', value: 105, currency: 'CAD' })
    expect(fbq.mock.calls.some((call) => call[1] === 'conversion')).toBe(false)
    expect(vi.mocked(posthog.capture).mock.calls.some((call) => call[0] === 'conversion')).toBe(false)
  })

  it.each([undefined, '', '  '])('does not emit an unidentified Ads conversion for booking ID %s', (bookingId) => {
    useTracking().trackBookingComplete('Coaching de couple', 160, 'meta-id', bookingId)
    expect(gtag.mock.calls.map((call) => call[1])).toEqual(['booking_confirmed'])
  })

  it('retains contact generate_lead without a booking event or Ads conversion', () => {
    useTracking().trackContactSubmit()
    expect(gtag.mock.calls).toEqual([
      ['event', 'generate_lead', { event_category: 'contact', event_label: 'contact_form' }],
    ])
    expect(fbq).toHaveBeenCalledWith('track', 'Contact')
    expect(posthog.capture).toHaveBeenCalledWith('contact_submitted', { source: 'contact_modal' })
  })

  it('does not convert when the calendar is opened', () => {
    const tracking = useTracking()
    tracking.trackBookingModalOpened('modal', 'couple')
    tracking.trackBookingStart()
    expect(gtag.mock.calls.map((call) => call[1])).toEqual(['begin_checkout'])
  })

  it('tolerates blocked Google/Meta tags', () => {
    vi.stubGlobal('window', {})
    expect(useTracking().trackBookingComplete('Coaching de couple', 160, 'meta-id', 'confirmed-id')).toBe('meta-id')
    expect(gtag).not.toHaveBeenCalled()
    expect(fbq).not.toHaveBeenCalled()
  })

  it('has no analytics side effects without a browser', () => {
    vi.stubGlobal('window', undefined)
    expect(useTracking().trackBookingComplete('Coaching de couple', 160, 'meta-id', 'confirmed-id')).toBe('meta-id')
    expect(gtag).not.toHaveBeenCalled()
    expect(fbq).not.toHaveBeenCalled()
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
