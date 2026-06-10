import { schedules, logger } from '@trigger.dev/sdk/v3'
import { google, type calendar_v3 } from 'googleapis'
import { normalizeGooglePrivateKey } from '../server/utils/googlePrivateKey'

/**
 * Post-séance Google Review ask, fired daily at 10:00 ET.
 *
 * Window: events that started 48-72h ago. The daily cadence + 24h window =
 * each booking has exactly one chance to be picked up.
 *
 * Privacy + dedupe live in Turso (`chantal_review_requests` in the TLS
 * dashboard DB) so the same email never gets pinged twice within 6 months,
 * and opt-out is honored. Belt-and-suspenders: we also stamp
 * `extendedProperties.private.reviewRequestedAt` on the calendar event after
 * a successful send, so a second cron pass within the window can't double-ask
 * even if Turso were unreachable.
 *
 * Required Trigger.dev env:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY              (keep \n escapes)
 *   GOOGLE_CALENDAR_ID
 *   RESEND_API_KEY
 *   REVIEW_EMAIL_FROM               default "Chantal Massé <hello@tech-lab.studio>"
 *   TURSO_DATABASE_URL              libsql:// of TLS dashboard DB
 *   TURSO_AUTH_TOKEN
 */

const GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJf0hxfazRyUwRzgp46r7fzIQ'

const WINDOW_HOURS_MIN = 48
const WINDOW_HOURS_MAX = 72
const REPEAT_AFTER_DAYS = 180

interface TursoExecResp {
  results: Array<{
    type: 'ok' | 'error'
    response?: {
      result: {
        cols: Array<{ name: string }>
        rows: Array<Array<{ type: string; value?: string }>>
      }
    }
    error?: { message: string }
  }>
}

interface TursoArg { type: 'text' | 'integer' | 'null'; value?: string }

async function tursoExec(sql: string, args: TursoArg[]): Promise<Record<string, string>[]> {
  const url = process.env.TURSO_DATABASE_URL
  const token = process.env.TURSO_AUTH_TOKEN
  if (!url || !token) throw new Error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN required')

  // libsql:// → https:// for the HTTP pipeline endpoint
  const httpUrl = url.replace(/^libsql:\/\//, 'https://').replace(/\/?$/, '') + '/v2/pipeline'

  const res = await fetch(httpUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args } },
        { type: 'close' },
      ],
    }),
  })
  if (!res.ok) throw new Error(`turso ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as TursoExecResp
  const r = data.results[0]
  if (!r || r.type === 'error' || !r.response) {
    throw new Error(`turso: ${r?.error?.message ?? 'no response'}`)
  }
  const cols = r.response.result.cols.map((c) => c.name)
  return r.response.result.rows.map((row) => {
    const obj: Record<string, string> = {}
    cols.forEach((c, i) => {
      obj[c] = row[i]?.value ?? ''
    })
    return obj
  })
}

interface BookingEvent {
  id: string
  startISO: string
  summary: string
  email: string
  name: string
}

function getCalendarClient(): calendar_v3.Calendar {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: normalizeGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}

async function fetchPastBookings(cal: calendar_v3.Calendar): Promise<BookingEvent[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID!
  const now = Date.now()
  const timeMin = new Date(now - WINDOW_HOURS_MAX * 3600 * 1000).toISOString()
  const timeMax = new Date(now - WINDOW_HOURS_MIN * 3600 * 1000).toISOString()

  const res = await cal.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  })

  const out: BookingEvent[] = []
  for (const e of res.data.items ?? []) {
    if (e.status === 'cancelled') continue
    const startISO = e.start?.dateTime ?? e.start?.date ?? ''
    if (!e.id || !startISO) continue
    const priv = (e.extendedProperties?.private as Record<string, string> | undefined) ?? {}
    const email = priv.clientEmail?.trim().toLowerCase() ?? ''
    if (!email || !email.includes('@')) continue
    if (priv.reviewRequestedAt) continue
    out.push({
      id: e.id,
      startISO,
      summary: e.summary ?? '',
      email,
      name: priv.clientName ?? '',
    })
  }
  return out
}

async function shouldSkipByDedupe(email: string): Promise<{ skip: boolean; reason: string }> {
  const rows = await tursoExec(
    'SELECT last_requested_at, opt_out FROM chantal_review_requests WHERE email = ?',
    [{ type: 'text', value: email }],
  )
  const row = rows[0]
  if (!row) return { skip: false, reason: 'first ask' }
  if (Number(row.opt_out ?? '0') === 1) return { skip: true, reason: 'opted out' }
  const last = String(row.last_requested_at ?? '')
  const ms = Date.now() - new Date(last + 'Z').getTime()
  const days = ms / 86400000
  if (days < REPEAT_AFTER_DAYS) return { skip: true, reason: `last asked ${days.toFixed(0)}d ago` }
  return { skip: false, reason: `repeat after ${days.toFixed(0)}d` }
}

async function recordRequest(email: string, name: string, eventId: string): Promise<void> {
  await tursoExec(
    `INSERT INTO chantal_review_requests (email, patient_name, first_requested_at, last_requested_at, request_count, last_event_id)
     VALUES (?, ?, datetime('now'), datetime('now'), 1, ?)
     ON CONFLICT(email) DO UPDATE SET
       last_requested_at = datetime('now'),
       request_count = request_count + 1,
       last_event_id = excluded.last_event_id,
       patient_name = COALESCE(NULLIF(excluded.patient_name, ''), chantal_review_requests.patient_name)`,
    [
      { type: 'text', value: email },
      { type: 'text', value: name },
      { type: 'text', value: eventId },
    ],
  )
}

async function markEventOnCalendar(cal: calendar_v3.Calendar, eventId: string): Promise<void> {
  await cal.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    eventId,
    requestBody: {
      extendedProperties: {
        private: { reviewRequestedAt: new Date().toISOString() },
      },
    },
  })
}

function firstName(name: string): string {
  const n = name.trim().split(/\s+/)[0] ?? ''
  return n.length > 0 ? n : 'vous'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Branded template (ported from ~/tls-vault/clients/chantal-masse/review-request-email.html,
// approved 2026-06-02). Newsreader/Manrope with serif/sans fallbacks (email clients rarely
// load web fonts — fallbacks carry it). Palette: charbon vert #173028 / crème #fef8f3 / taupe.
// First name is inlined into the greeting; review URL is the direct write-review link
// (GOOGLE_REVIEW_URL). Opt-out is reply-"stop" (enforced by chantal_review_requests.opt_out).
function buildHtml(name: string): string {
  const fn = firstName(name)
  return `<!DOCTYPE html>
<html lang="fr-CA" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Un mot après notre rencontre</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Georgia, 'Times New Roman', serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f0e7dd; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

  <div style="display:none; font-size:1px; color:#f0e7dd; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    Merci de la confiance que tu m'as accordée. — Chantal
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0e7dd;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#fef8f3; border-radius:4px;">

          <tr>
            <td style="height:4px; line-height:4px; font-size:4px; background-color:#173028; border-radius:4px 4px 0 0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:48px 48px 16px 48px;">

              <p style="margin:0 0 28px 0; font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-style:italic; font-weight:400; font-size:26px; line-height:1.3; color:#173028;">
                Un mot, après notre rencontre.
              </p>

              <p style="margin:0 0 20px 0; font-family:'Manrope', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight:400; font-size:17px; line-height:1.65; color:#2e2a26;">
                Bonjour ${escapeHtml(fn)},
              </p>

              <p style="margin:0 0 20px 0; font-family:'Manrope', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight:400; font-size:17px; line-height:1.65; color:#2e2a26;">
                Merci pour la confiance que tu m'as accordée en venant me voir. Prendre ce temps pour soi demande du courage, et je suis touchée d'avoir pu être là.
              </p>

              <p style="margin:0 0 20px 0; font-family:'Manrope', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight:400; font-size:17px; line-height:1.65; color:#2e2a26;">
                Si tu en as envie, quelques mots laissés en avis aident d'autres personnes des Cantons-de-l'Est à trouver le chemin vers une première rencontre.
              </p>

            </td>
          </tr>

          <tr>
            <td style="padding:8px 48px 16px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#173028" style="border-radius:4px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${GOOGLE_REVIEW_URL}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="8%" strokecolor="#173028" fillcolor="#173028">
                    <w:anchorlock/>
                    <center style="color:#fef8f3;font-family:Georgia,serif;font-size:17px;font-weight:bold;">Laisser un avis Google</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${GOOGLE_REVIEW_URL}" target="_blank" style="display:inline-block; min-width:200px; padding:16px 32px; font-family:'Manrope', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:17px; font-weight:600; line-height:20px; color:#fef8f3; text-decoration:none; border-radius:4px; background-color:#173028;">
                      Laisser un avis Google
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 48px 40px 48px;">
              <p style="margin:0 0 4px 0; font-family:'Manrope', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight:400; font-size:17px; line-height:1.65; color:#2e2a26;">
                Au plaisir,
              </p>
              <p style="margin:0; font-family:'Newsreader', Georgia, 'Times New Roman', serif; font-style:italic; font-weight:400; font-size:22px; line-height:1.4; color:#173028;">
                Chantal Massé
              </p>
              <p style="margin:6px 0 0 0; font-family:'Manrope', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight:400; font-size:14px; line-height:1.5; color:#6b6259;">
                Thérapeute en relation d'aide &middot; Shefford, Cantons-de-l'Est
              </p>
            </td>
          </tr>

        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td style="padding:24px 48px 8px 48px;" align="center">
              <p style="margin:0; font-family:'Manrope', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight:400; font-size:12px; line-height:1.6; color:#9a9088;">
                Tu reçois ce courriel à la suite de ta séance avec Chantal Massé.<br>
                Pour ne plus en recevoir, réponds simplement « stop » à ce message.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`
}

interface ResendResponse {
  id?: string
  message?: string
}

async function sendViaResend(to: string, name: string): Promise<ResendResponse> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not set')
  const from = process.env.REVIEW_EMAIL_FROM ?? 'Chantal Massé <hello@tech-lab.studio>'
  const subject = 'Un mot après notre rencontre'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: 'chantal.gmasse@gmail.com',
      subject,
      html: buildHtml(name),
    }),
  })
  const body = (await res.json()) as ResendResponse
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? 'unknown'}`)
  return body
}

export const reviewRequest = schedules.task({
  id: 'chantalmasse-review-request',
  cron: {
    pattern: '0 10 * * *',
    timezone: 'America/Toronto',
  },
  maxDuration: 120,
  machine: 'medium-1x',
  run: async (payload) => {
    logger.info('review-request: starting', { scheduledAt: payload.timestamp })

    const cal = getCalendarClient()
    const bookings = await fetchPastBookings(cal)
    logger.info('review-request: scanned window', {
      windowHoursMin: WINDOW_HOURS_MIN,
      windowHoursMax: WINDOW_HOURS_MAX,
      bookingsWithEmail: bookings.length,
    })

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const b of bookings) {
      try {
        const dedupe = await shouldSkipByDedupe(b.email)
        if (dedupe.skip) {
          skipped++
          logger.info('review-request: skipped', { email: b.email, reason: dedupe.reason })
          continue
        }
        const r = await sendViaResend(b.email, b.name)
        await recordRequest(b.email, b.name, b.id)
        await markEventOnCalendar(cal, b.id)
        sent++
        logger.info('review-request: sent', { email: b.email, resendId: r.id })
      } catch (err) {
        failed++
        logger.error('review-request: failed', {
          email: b.email,
          eventId: b.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return {
      scanned: bookings.length,
      sent,
      skipped,
      failed,
    }
  },
})
