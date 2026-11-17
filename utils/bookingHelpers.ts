import {
  addMinutes,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isAfter,
  isBefore,
  parseISO,
  format,
  getDay,
  startOfDay,
  addDays,
} from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const BOOKING_TIMEZONE = 'America/Toronto'

// Working hours by weekday (0=Sun, 1=Mon, ..., 6=Sat)
export const WORKING_HOURS: Record<number, { start: string; end: string }> = {
  1: { start: '10:30', end: '18:30' }, // Monday
  2: { start: '09:00', end: '18:30' }, // Tuesday
  3: { start: '09:00', end: '17:00' }, // Wednesday
  4: { start: '09:00', end: '17:00' }, // Thursday
  // 0 (Sunday), 5 (Friday), and 6 (Saturday): closed
}

export const BUFFER_MINUTES = 15
export const SLOT_INTERVAL = 15 // minutes between slot start times

export interface TimeSlot {
  isoStart: string
  isoEnd: string
  label: string
}

export interface CalendarEvent {
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
}

/**
 * Generate all possible time slots for a given date in the booking timezone.
 * Returns slots that do not conflict with existing calendar events.
 */
export function generateSlotsForDate(
  dateInET: Date,
  durationMinutes: number,
  existingEvents: CalendarEvent[],
  minNoticeHours: number = 24,
): TimeSlot[] {
  const dayOfWeek = getDay(dateInET) // 0=Sun in local (ET) time

  const workingHours = WORKING_HOURS[dayOfWeek]
  if (!workingHours) return []

  const [startH, startM] = workingHours.start.split(':').map(Number)
  const [endH, endM] = workingHours.end.split(':').map(Number)

  const dayStart = setMilliseconds(
    setSeconds(setMinutes(setHours(startOfDay(dateInET), startH), startM), 0),
    0,
  )
  const dayEnd = setMilliseconds(
    setSeconds(setMinutes(setHours(startOfDay(dateInET), endH), endM), 0),
    0,
  )

  const minNoticeMs = Date.now() + minNoticeHours * 3_600_000
  // Busy intervals in absolute ms, converted once per day rather than per
  // candidate slot: per-slot timezone conversions cost >1 s of Worker CPU on
  // a busy month (Cloudflare 1102). All-day events block their whole ET day.
  const busy = toBusyIntervals(existingEvents)
  // DST switches happen at 02:00, never inside working hours, so slot
  // instants are plain offsets from the day's first slot.
  const dayStartMs = fromZonedTime(dayStart, BOOKING_TIMEZONE).getTime()
  const bufferMs = BUFFER_MINUTES * 60_000

  const slots: TimeSlot[] = []
  for (
    let slotStart = dayStart, offset = 0;
    !isAfter(addMinutes(slotStart, durationMinutes), dayEnd);
    slotStart = addMinutes(slotStart, SLOT_INTERVAL), offset += SLOT_INTERVAL
  ) {
    const startMs = dayStartMs + offset * 60_000
    const endMs = startMs + durationMinutes * 60_000
    if (startMs < minNoticeMs) continue
    if (busy.some(([s, e]) => startMs - bufferMs < e && endMs + bufferMs > s)) continue

    const slotEnd = addMinutes(slotStart, durationMinutes)
    slots.push({
      isoStart: new Date(startMs).toISOString(),
      isoEnd: new Date(endMs).toISOString(),
      label: `${format(slotStart, 'HH')}h${format(slotStart, 'mm')} — ${format(slotEnd, 'HH')}h${format(slotEnd, 'mm')}`,
    })
  }

  return slots
}

function eventBoundMs(bound: { dateTime?: string | null; date?: string | null } | null | undefined): number | null {
  if (bound?.dateTime) return parseISO(bound.dateTime).getTime()
  if (bound?.date) return fromZonedTime(`${bound.date}T00:00:00`, BOOKING_TIMEZONE).getTime()
  return null
}

function toBusyIntervals(events: CalendarEvent[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const ev of events) {
    const s = eventBoundMs(ev.start)
    const e = eventBoundMs(ev.end)
    if (s !== null && e !== null) out.push([s, e])
  }
  return out
}

/**
 * Check if a specific ISO slot is still available (no conflict with events).
 */
export function isSlotAvailable(
  isoStart: string,
  isoEnd: string,
  existingEvents: CalendarEvent[],
): boolean {
  const slotStart = parseISO(isoStart)
  const slotEnd = parseISO(isoEnd)

  const bufferedStart = addMinutes(slotStart, -BUFFER_MINUTES)
  const bufferedEnd = addMinutes(slotEnd, BUFFER_MINUTES)

  return !existingEvents.some((event) => {
    const evStartStr = event.start?.dateTime || event.start?.date
    const evEndStr = event.end?.dateTime || event.end?.date
    if (!evStartStr || !evEndStr) return false

    const evStart = parseISO(evStartStr)
    const evEnd = parseISO(evEndStr)

    return isBefore(bufferedStart, evEnd) && isAfter(bufferedEnd, evStart)
  })
}

/**
 * Get all dates in a month that have at least one available slot.
 */
export function getAvailableDatesInMonth(
  year: number,
  month: number, // 1-indexed
  durationMinutes: number,
  existingEvents: CalendarEvent[],
  advanceDays: number = 60,
  minNoticeHours: number = 24,
): { availableDates: string[]; slotsByDate: Record<string, TimeSlot[]> } {
  const today = new Date()
  const maxDate = addDays(today, advanceDays)

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  const availableDates: string[] = []
  const slotsByDate: Record<string, TimeSlot[]> = {}

  let current = new Date(firstDay)

  while (current <= lastDay) {
    const dateKey = format(current, 'yyyy-MM-dd')

    // Skip past dates and dates beyond advance window
    if (isBefore(current, startOfDay(today)) || isAfter(current, maxDate)) {
      current = addDays(current, 1)
      continue
    }

    // Convert to ET for day-of-week check
    const dateInET = toZonedTime(
      fromZonedTime(current, BOOKING_TIMEZONE),
      BOOKING_TIMEZONE,
    )

    const slots = generateSlotsForDate(
      dateInET,
      durationMinutes,
      existingEvents,
      minNoticeHours,
    )

    if (slots.length > 0) {
      availableDates.push(dateKey)
      slotsByDate[dateKey] = slots
    }

    current = addDays(current, 1)
  }

  return { availableDates, slotsByDate }
}

/**
 * "jeudi 19 novembre, 14 h" / "mardi 1er décembre, 9 h 30" in the booking timezone
 * (non-breaking spaces inside the time so it never wraps).
 */
export function formatSlotStart(isoStart: string): string {
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone: BOOKING_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoStart))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''
  const minute = part('minute')
  const day = part('day') === '1' ? '1er' : part('day')
  return `${part('weekday')} ${day} ${part('month')}, ${Number(part('hour'))}\u00a0h${minute === '00' ? '' : `\u00a0${minute}`}`
}

/**
 * Generate Google Calendar add URL
 */
export function googleCalendarUrl(params: {
  title: string
  start: string // ISO
  end: string // ISO
  description?: string
  location?: string
}): string {
  const fmt = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.000Z', 'Z')

  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', params.title)
  url.searchParams.set('dates', `${fmt(params.start)}/${fmt(params.end)}`)
  if (params.description) url.searchParams.set('details', params.description)
  if (params.location) url.searchParams.set('location', params.location)
  return url.toString()
}

/**
 * Generate ICS file content for Apple Calendar
 */
export function generateICS(params: {
  title: string
  start: string // ISO
  end: string // ISO
  description?: string
  location?: string
  uid: string
}): string {
  const fmt = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.000Z', 'Z')

  const now = fmt(new Date().toISOString())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chantal Massé//Booking//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.uid}@chantalmasse.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmt(params.start)}`,
    `DTEND:${fmt(params.end)}`,
    `SUMMARY:${params.title}`,
    params.description ? `DESCRIPTION:${params.description.replace(/\n/g, '\\n')}` : '',
    params.location ? `LOCATION:${params.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  return lines
}
