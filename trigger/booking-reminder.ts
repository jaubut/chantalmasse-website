import { schedules, logger } from '@trigger.dev/sdk/v3'
import { google } from 'googleapis'
import { parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { clientReminderEmail } from '../server/utils/emailTemplates'
import { bookingReminderSms, sendSms } from '../server/utils/sms'
import { normalizeGooglePrivateKey } from '../server/utils/googlePrivateKey'
import {
  classifySession,
  greetingName,
  resolveGuestEmails,
} from '../server/utils/chantalSessionRules'

/**
 * Hourly scan for bookings starting in ~24h. Sends two reminder channels
 * independently so a failure on one doesn't block the other:
 *   1. Email via Resend  — always (existing behavior, gated by reminderSent="0")
 *   2. SMS via Twilio    — only when the booking opted in (smsConsent="1"),
 *                          gated by smsReminderSent="0"
 *
 * Two booking sources are handled:
 *   - Form bookings    — client data stamped on extendedProperties.private.
 *   - Manual bookings  — entered directly in Google Calendar by Chantal, with
 *                        the clients attached as guests. Email-only (attendees
 *                        carry no phone/consent). EVERY qualifying guest is
 *                        emailed, so both partners on a couple booking get a
 *                        reminder. Whether an event is a séance is decided by
 *                        the shared blocklist in server/utils/chantalSessionRules,
 *                        mirroring the dashboard's invoice sync, so séances
 *                        titled with a bare patient name are no longer dropped.
 *
 * Window: events starting between now+23h and now+25h. The Google Calendar
 * extendedProperty AND-filter can't express "either flag pending", so we pull
 * the whole window once and branch in code.
 *
 * This task is standalone — it does not use nuxt's useRuntimeConfig().
 * Required env vars (set in Trigger.dev dashboard):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY          (keep literal \n escapes)
 *   GOOGLE_CALENDAR_ID
 *   RESEND_API_KEY
 *   EMAIL_FROM
 *   TWILIO_ACCOUNT_SID          (only required if any event has smsConsent="1")
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER
 *   SITE_BASE_URL               (e.g. "https://chantalmasse.com")
 */

const SERVICE_NAME_BY_COLOR: Record<string, string> = {
  '2': 'Thérapie Individuelle',
  '7': 'Coaching de Couple',
}

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: normalizeGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}

async function sendResend(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend ${res.status}: ${text}`)
  }
}

export const bookingReminder = schedules.task({
  id: 'chantalmasse-booking-reminder',
  cron: {
    pattern: '0 * * * *', // top of every hour
    timezone: 'America/Toronto',
  },
  maxDuration: 120,
  machine: 'medium-1x',
  run: async (_payload, { ctx }) => {
    for (const envVar of [
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_CALENDAR_ID',
      'RESEND_API_KEY',
      'EMAIL_FROM',
    ]) {
      if (!process.env[envVar]) throw new Error(`${envVar} env var is not set`)
    }

    const siteBaseUrl = process.env.SITE_BASE_URL || 'https://chantalmasse.com'
    const calendar = getCalendarClient()
    const calendarId = process.env.GOOGLE_CALENDAR_ID!

    const now = new Date()
    const timeMin = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString()
    const timeMax = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

    logger.info('Scanning for reminders', { timeMin, timeMax })

    const listRes = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = listRes.data.items || []
    logger.info(`Found ${events.length} event(s) in reminder window`)

    let emailSent = 0
    let smsSent = 0
    let skipped = 0
    let notSession = 0
    let emailFailed = 0
    let smsFailed = 0

    for (const ev of events) {
      const priv = ev.extendedProperties?.private || {}
      const summary = ev.summary || ''

      if (!ev.id || !ev.start?.dateTime || !ev.end?.dateTime) {
        logger.warn('Skipping event with missing id/start/end', { id: ev.id, summary })
        skipped++
        continue
      }

      const startISO = ev.start.dateTime
      const endISO = ev.end.dateTime
      const durationMin = Math.round(
        (new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000,
      )

      // Form bookings stamp clientEmail on private props. Manual bookings
      // (Chantal types them into Calendar) attach the clients as guests instead.
      const isManual = !priv.clientEmail

      // Manual titles are inconsistent, so they go through the shared blocklist
      // gate rather than the old colour/keyword allowlist, which silently
      // dropped every séance titled with a bare patient name. Form bookings are
      // sessions by construction and bypass the gate.
      if (isManual) {
        const verdict = classifySession({
          summary,
          status: ev.status,
          startDateTime: startISO,
          durationMin,
          colorId: ev.colorId,
          attendees: ev.attendees || [],
        })
        if (!verdict.session) {
          logger.info('Not a session, skipping', {
            eventId: ev.id,
            summary,
            reason: verdict.reason,
          })
          notSession++
          continue
        }
      }

      // Every guest, not just the first: a couple booking carries both partners
      // and the old .find() left the second one with no reminder at all.
      const recipients = isManual
        ? resolveGuestEmails(ev.attendees, {
            serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            calendarId,
          })
        : [priv.clientEmail!.trim().toLowerCase()]

      const clientPhone = priv.clientPhone
      const cancelToken = priv.cancelToken || ''
      const sessionType = (priv.sessionType === 'video' ? 'video' : 'in-person') as
        | 'video'
        | 'in-person'

      let service = ev.colorId ? SERVICE_NAME_BY_COLOR[ev.colorId] : undefined
      if (!service) {
        if (/couple/i.test(summary)) service = 'Coaching de Couple'
        else if (/th[ée]rapie|individuel/i.test(summary)) service = 'Thérapie Individuelle'
        else service = 'Séance'
      }

      const firstName = greetingName(summary, priv.clientName)

      // Addresses already emailed for this event, so a partial failure retries
      // only what did not get through instead of double-sending to everyone.
      const alreadySent = new Set(
        (priv.reminderSentTo || '')
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      )
      const emailDone = priv.reminderSent === '1'
      const pending = emailDone ? [] : recipients.filter((e) => !alreadySent.has(e))
      const smsPending = priv.smsConsent === '1' && priv.smsReminderSent !== '1'

      if (!recipients.length) {
        logger.warn('No recipient resolvable for session', {
          eventId: ev.id,
          summary,
          isManual,
          attendees: (ev.attendees || []).length,
        })
        skipped++
        continue
      }

      if (emailDone && !smsPending) continue

      const startET = toZonedTime(parseISO(startISO), 'America/Toronto')
      const endET = toZonedTime(parseISO(endISO), 'America/Toronto')
      const dateFormatted = format(startET, 'EEEE d MMMM yyyy', { locale: fr })
      const timeFormatted = `${format(startET, 'HH')}h${format(startET, 'mm')} — ${format(endET, 'HH')}h${format(endET, 'mm')}`
      const startTime = `${format(startET, 'HH')}h${format(startET, 'mm')}`

      // Video séances reuse Chantal's permanent Meet room, stamped on the event
      // at booking time (no per-event conferenceData — see googleCalendar.ts).
      const meetLink = priv.meetLink || undefined

      if (!emailDone) {
        const delivered: string[] = []

        for (const to of pending) {
          try {
            const { subject, html } = clientReminderEmail({
              firstName,
              service,
              date: dateFormatted,
              time: timeFormatted,
              sessionType,
              meetLink,
              cancelToken,
            })

            await sendResend(to, subject, html)

            delivered.push(to)
            emailSent++
            logger.info('Email reminder sent', { eventId: ev.id, to })
          } catch (err) {
            emailFailed++
            logger.error('Email reminder failed', {
              eventId: ev.id,
              to,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        const confirmed = recipients.filter((e) => alreadySent.has(e) || delivered.includes(e))
        const allDelivered = confirmed.length === recipients.length

        if (delivered.length || allDelivered) {
          try {
            await calendar.events.patch({
              calendarId,
              eventId: ev.id,
              requestBody: {
                extendedProperties: {
                  // Once everyone has it, reminderSent alone closes the event;
                  // the per-address list only matters for retrying a partial send.
                  private: allDelivered
                    ? { reminderSent: '1' }
                    : { reminderSentTo: confirmed.join(',') },
                },
              },
            })
          } catch (err) {
            // Losing this stamp means the next hourly run re-sends, so make it loud.
            logger.error('Failed to stamp reminder state on event', {
              eventId: ev.id,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
      }

      // SMS branch — form bookings only: manual guests carry no phone or consent.
      if (smsPending) {
        if (!clientPhone) {
          logger.warn('smsConsent set but no clientPhone on event', { eventId: ev.id })
          skipped++
        } else {
          try {
            const body = bookingReminderSms({
              firstName,
              dateFormatted,
              startTime,
              sessionType,
              cancelUrl: `${siteBaseUrl}/annuler?token=${cancelToken}`,
            })

            await sendSms(clientPhone, body)

            await calendar.events.patch({
              calendarId,
              eventId: ev.id,
              requestBody: {
                extendedProperties: { private: { smsReminderSent: '1' } },
              },
            })

            smsSent++
            logger.info('SMS reminder sent', { eventId: ev.id, to: clientPhone })
          } catch (err) {
            smsFailed++
            logger.error('SMS reminder failed', {
              eventId: ev.id,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
      }
    }

    return {
      scanned: events.length,
      emailSent,
      smsSent,
      skipped,
      notSession,
      emailFailed,
      smsFailed,
    }
  },
})
