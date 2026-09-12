// Booking-reminder audit — read-only.
//
// Replays the reminder task's decision logic over a date range of Chantal's
// Google Calendar and prints, per session, whether a reminder was sent, is
// still pending, or was dropped and why. Use it to confirm a client really did
// not get their 24h notification, and to spot events whose title or guest list
// will keep them from ever being reminded.
//
// Env vars required (same values as the Trigger.dev task):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_PRIVATE_KEY
//   GOOGLE_CALENDAR_ID
//
// Usage:
//   bun run scripts/audit-booking-reminders.ts [from YYYY-MM-DD] [to YYYY-MM-DD]

import { google } from 'googleapis'
import { normalizeGooglePrivateKey } from '../server/utils/googlePrivateKey'
import {
  classifySession,
  greetingName,
  resolveGuestEmails,
} from '../server/utils/chantalSessionRules'

const DAY_MS = 86_400_000

async function main() {
  const from = process.argv[2] || new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10)
  const to = process.argv[3] || new Date(Date.now() + 7 * DAY_MS).toISOString().slice(0, 10)

  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!serviceAccountEmail || !calendarId || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_CALENDAR_ID are required')
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: normalizeGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date(`${from}T00:00:00Z`).toISOString(),
    timeMax: new Date(`${to}T00:00:00Z`).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500,
  })

  const problems: string[] = []
  let sessions = 0

  const pad = (v: unknown, n: number) => String(v).slice(0, n).padEnd(n)
  console.log(
    pad('START', 17), pad('TITLE', 36), pad('COL', 5), pad('SRC', 7),
    pad('GREETS', 12), pad('G', 2), 'STATE',
  )

  for (const ev of res.data.items || []) {
    const priv = ev.extendedProperties?.private || {}
    const summary = ev.summary || ''
    const startISO = ev.start?.dateTime || null
    const durationMin =
      startISO && ev.end?.dateTime
        ? Math.round((new Date(ev.end.dateTime).getTime() - new Date(startISO).getTime()) / 60000)
        : 0

    const isManual = !priv.clientEmail
    if (isManual) {
      const verdict = classifySession({ summary, status: ev.status, startDateTime: startISO, durationMin })
      if (!verdict.session) continue
    }
    sessions++

    const recipients = isManual
      ? resolveGuestEmails(ev.attendees, { serviceAccountEmail, calendarId })
      : [priv.clientEmail!.trim().toLowerCase()]

    const notified = new Set(
      (priv.reminderSentTo || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    )
    const missing = recipients.filter((e) => !notified.has(e))

    let state: string
    if (!recipients.length) state = 'NO GUEST — cannot be reminded'
    else if (priv.reminderSent === '1') state = 'sent'
    else if (notified.size && missing.length) state = `PARTIAL — missing ${missing.join(', ')}`
    else if (new Date(startISO || 0).getTime() < Date.now()) state = `NEVER SENT — ${recipients.join(', ')}`
    else state = 'pending'

    if (state !== 'sent' && state !== 'pending') {
      problems.push(`${(startISO || '').slice(0, 16)}  "${summary}"  ${state}`)
    }

    console.log(
      pad((startISO || '').slice(0, 16), 17), pad(summary, 36), pad(ev.colorId || '-', 5),
      pad(isManual ? 'manual' : 'form', 7), pad(greetingName(summary, priv.clientName) || '(none)', 12),
      pad(recipients.length, 2), state,
    )
  }

  console.log(`\n${sessions} sessions between ${from} and ${to} · ${problems.length} with a reminder problem`)
  for (const p of problems) console.log(`  !! ${p}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
