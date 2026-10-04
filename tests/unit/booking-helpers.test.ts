import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BOOKING_TIMEZONE, generateICS, generateSlotsForDate, getAvailableDatesInMonth,
  googleCalendarUrl, isSlotAvailable,
} from '~/utils/bookingHelpers'
import { BOOKING_SERVICES, getBookingService } from '~/utils/bookingServices'

// Monday 2026-10-05, 08:00 EDT (TZ=UTC like Vercel, see vitest.config.ts).
beforeEach(() => { vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z'), toFake: ['Date'] }) })
afterEach(() => { vi.useRealTimers() })

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe('generateSlotsForDate', () => {
  it('runs in the booking timezone', () => {
    expect(BOOKING_TIMEZONE).toBe('America/Toronto')
  })

  it('offers 15-minute starts across Tuesday hours (09:00–18:30)', () => {
    const slots = generateSlotsForDate(day(2026, 10, 13), 60, [])
    expect(slots).toHaveLength(35)
    expect(slots[0]!.label).toBe('09h00 — 10h00')
    expect(slots.at(-1)!.label).toBe('17h30 — 18h30')
  })

  it('starts Mondays at 10:30', () => {
    expect(generateSlotsForDate(day(2026, 10, 12), 60, [])[0]!.label).toBe('10h30 — 11h30')
  })

  it.each([16, 17, 18])('is closed Friday–Sunday (Oct %i)', (d) => {
    expect(generateSlotsForDate(day(2026, 10, d), 60, [])).toEqual([])
  })

  it('applies the minimum notice', () => {
    expect(generateSlotsForDate(day(2026, 10, 6), 60, [], 26)[0]!.label).toBe('10h00 — 11h00')
  })

  it('handles the DST change (EST in November → UTC-5)', () => {
    expect(generateSlotsForDate(day(2026, 11, 10), 60, [])[0]!.isoStart).toBe('2026-11-10T14:00:00.000Z')
  })

  it('ignores all-day events without times and events with missing bounds', () => {
    const slots = generateSlotsForDate(day(2026, 10, 13), 60, [{ start: null, end: null }, { start: { dateTime: null } }])
    expect(slots).toHaveLength(35)
  })
})

describe('getAvailableDatesInMonth', () => {
  it('stops at the advance window', () => {
    const { availableDates } = getAvailableDatesInMonth(2026, 12, 60, [], 60, 24)
    expect(availableDates).toEqual(['2026-12-01', '2026-12-02', '2026-12-03'])
  })

  it('drops a fully booked day', () => {
    const allDay = [{ start: { dateTime: '2026-10-13T08:00:00-04:00' }, end: { dateTime: '2026-10-13T19:00:00-04:00' } }]
    const { availableDates, slotsByDate } = getAvailableDatesInMonth(2026, 10, 60, allDay)
    expect(availableDates).not.toContain('2026-10-13')
    expect(slotsByDate['2026-10-13']).toBeUndefined()
  })
})

describe('isSlotAvailable', () => {
  const ev = [{ start: { dateTime: '2026-10-13T16:00:00Z' }, end: { dateTime: '2026-10-13T17:00:00Z' } }]
  it('applies the 15 minute buffer on both sides', () => {
    expect(isSlotAvailable('2026-10-13T14:45:00Z', '2026-10-13T15:45:00Z', ev)).toBe(true)
    expect(isSlotAvailable('2026-10-13T15:00:00Z', '2026-10-13T16:00:00Z', ev)).toBe(false)
    expect(isSlotAvailable('2026-10-13T17:00:00Z', '2026-10-13T18:00:00Z', ev)).toBe(false)
    expect(isSlotAvailable('2026-10-13T17:15:00Z', '2026-10-13T18:15:00Z', ev)).toBe(true)
  })
})

describe('add-to-calendar links', () => {
  const params = { title: 'Séance avec Chantal', start: '2026-10-13T13:00:00.000Z', end: '2026-10-13T14:00:00.000Z', description: 'L1\nL2', location: 'Shefford, QC' }

  it('builds a Google Calendar template URL', () => {
    const url = new URL(googleCalendarUrl(params))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20261013T130000Z/20261013T140000Z')
    expect(url.searchParams.get('text')).toBe('Séance avec Chantal')
  })

  it('builds a valid ICS file', () => {
    const ics = generateICS({ ...params, uid: 'evt1' })
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines.at(-1)).toBe('END:VCALENDAR')
    expect(lines).toContain('UID:evt1@chantalmasse.com')
    expect(lines).toContain('DTSTART:20261013T130000Z')
    expect(lines).toContain('DESCRIPTION:L1\\nL2')
  })
})

describe('booking services', () => {
  it('exposes the two services with consistent durations', () => {
    expect(BOOKING_SERVICES.map(s => [s.id, s.durationMinutes, s.price])).toEqual([
      ['individual', 60, 105],
      ['couple', 90, 160],
    ])
    for (const s of BOOKING_SERVICES) expect(s.duration).toBe(`${s.durationMinutes} minutes`)
  })

  it('looks services up by id', () => {
    expect(getBookingService('couple')?.name).toBe('Coaching de Couple')
    expect(getBookingService('nope')).toBeNull()
    expect(getBookingService(null)).toBeNull()
  })
})
