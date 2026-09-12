/**
 * Shared rules for deciding whether a Google Calendar event is a real séance,
 * who should be emailed about it, and what to call them.
 *
 * Chantal enters most bookings by hand, so titles are inconsistent. The
 * previous reminder gate was an allowlist -- colour 2/7 OR a title matching
 * /thérapie|coaching/ -- and it silently dropped real séances whose title was
 * a bare patient name ("Anne Boutin"), carried a typo ("Coahing de couple-…"),
 * or used one of the other shapes observed on her live calendar
 * ("Séance — Milane Cirnigliaro", "Coach de Couple for Donat +1438…").
 *
 * The dashboard's invoice sync (server/lib/chantalInvoiceSync.ts in
 * tls-dashboard-v2) has billed her sessions correctly for months using a
 * blocklist instead of an allowlist, so we mirror that decision here: an event
 * is a séance unless it looks like a block, a cancellation, or admin time.
 */

/** Titles that are never a client séance. Mirrors the invoice sync. */
export const SKIP_TITLE_PATTERNS =
  /annul|no.?show|\blibre\b|\bvacances?\b|\bplage\b|\bpause\b|\bbloqu[eé]e?\b|\badmin\b|\bperso\b|^cm\b/i

/** Anything shorter than this is a block or a note, not a session. */
export const MIN_SESSION_MINUTES = 30

/** Words that mark the part of a title before a dash as a service label. */
const SERVICE_LABEL = /couple|th[ée]rapie|coach|coahing|s[ée]ance|individuel/i

export interface SessionGateInput {
  summary: string
  status?: string | null
  /** Event start; absent or date-only means an all-day block. */
  startDateTime?: string | null
  durationMin: number
}

export interface SessionVerdict {
  session: boolean
  /** Always populated so callers can log why an event was skipped. */
  reason: string
}

/**
 * Decide whether an event is a client séance that deserves a reminder.
 * Pure: no calendar or network access, so it is directly testable.
 */
export function classifySession(ev: SessionGateInput): SessionVerdict {
  if (ev.status === 'cancelled') return { session: false, reason: 'event cancelled' }
  if (!ev.summary || !ev.summary.trim()) return { session: false, reason: 'no title' }
  if (!ev.startDateTime) return { session: false, reason: 'all-day event' }
  if (/^\d{4}-\d{2}-\d{2}$/.test(ev.startDateTime)) return { session: false, reason: 'all-day event' }
  if (SKIP_TITLE_PATTERNS.test(ev.summary)) return { session: false, reason: 'title matches block pattern' }
  if (ev.durationMin < MIN_SESSION_MINUTES) {
    return { session: false, reason: `duration ${ev.durationMin}min below ${MIN_SESSION_MINUTES}min minimum` }
  }
  return { session: true, reason: 'session' }
}

/**
 * Strip service labels, decorations and trailing phone numbers off a title to
 * get the patient name. Ported from the invoice sync, with one fix: the old
 * reminder task split on the first "-" unconditionally, so "Annie-Pier Legault"
 * became "Pier Legault". We only strip a dash prefix when that prefix actually
 * reads as a service label.
 */
export function extractPatientName(summary: string): string {
  let s = (summary || '')
    .replace(/^\s*coach\s+de\s+couple\s+(for\s+)?/i, '')
    .replace(/^\s*th[ée]rapie\s+individuelle\s+(for\s+)?/i, '')
    .replace(/^\s*th[ée]rapie\s+ind[\s\-]+/i, '')
    .replace(/^\s*s[ée]ance\s*[—–\-]\s*/i, '')

  // "Coaching de couple-Ronald Bonheur" and its typo variants: strip the label
  // before the first dash, but only when it is a label and not part of a name.
  const dash = s.search(/[—–\-]/)
  if (dash > 0) {
    const prefix = s.slice(0, dash)
    if (prefix.length <= 30 && SERVICE_LABEL.test(prefix)) {
      s = s.slice(dash + 1)
    }
  }

  return s
    .replace(/[\s—–\-•|]+\s*(coaching\s+)?(de\s+)?couple\s*$/i, '')
    .replace(/[\s—–\-•|]+\s*(coaching\s+)?personnel\s*$/i, '')
    .replace(/\s+\+?\d[\d\s\-().]{8,}$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** First name for the email greeting, or '' when the title yields nothing usable. */
export function greetingName(summary: string, clientName?: string | null): string {
  const full = (clientName && clientName.trim()) || extractPatientName(summary)
  const first = full.split(/\s+/)[0] || ''
  // A bare phone number or stray punctuation is worse than no name at all.
  if (!/[a-zà-ÿ]/i.test(first)) return ''
  // "Coaching" as a whole title is a label, not a person.
  if (/^(coaching|coahing|coach|s[ée]ance|th[ée]rapie|couple|personnel|individuelle?)$/i.test(first)) return ''
  return first
}

export interface CalendarAttendee {
  email?: string | null
  self?: boolean | null
  organizer?: boolean | null
  resource?: boolean | null
  responseStatus?: string | null
}

/**
 * Every guest who should receive the reminder. The old task used .find(), so on
 * a couple booking with both partners attached only the first was ever emailed.
 */
export function resolveGuestEmails(
  attendees: CalendarAttendee[] | null | undefined,
  opts: { serviceAccountEmail?: string; calendarId?: string },
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of attendees || []) {
    const email = (a.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) continue
    if (a.self || a.organizer || a.resource) continue
    if (opts.serviceAccountEmail && email === opts.serviceAccountEmail.toLowerCase()) continue
    if (opts.calendarId && email === opts.calendarId.toLowerCase()) continue
    if (a.responseStatus === 'declined') continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}
