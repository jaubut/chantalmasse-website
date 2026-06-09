import { schedules, logger } from '@trigger.dev/sdk/v3'
import { google } from 'googleapis'
import { parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { clientReminderEmail } from '../server/utils/emailTemplates'
import { bookingReminderSms, sendSms } from '../server/utils/sms'

/**
 * Hourly scan for bookings starting in ~24h. Sends two reminder channels
 * independently so a failure on one doesn't block the other:
 *   1. Email via Resend  — always (existing behavior, gated by reminderSent="0")
 *   2. SMS via Twilio    — only when the booking opted in (smsConsent="1"),
 *                          gated by smsReminderSent="0"
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
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
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
    let emailFailed = 0
    let smsFailed = 0

    for (const ev of events) {
      const priv = ev.extendedProperties?.private || {}
      const clientEmail = priv.clientEmail
      const clientName = priv.clientName || ''
      const clientPhone = priv.clientPhone
      const cancelToken = priv.cancelToken || ''
      const sessionType = (priv.sessionType === 'video' ? 'video' : 'in-person') as
        | 'video'
        | 'in-person'

      const emailPending = priv.reminderSent !== '1'
      const smsPending = priv.smsConsent === '1' && priv.smsReminderSent !== '1'

      if (!emailPending && !smsPending) {
        // Both channels already handled; nothing to do.
        continue
      }

      if (!clientEmail || !ev.start?.dateTime || !ev.end?.dateTime || !ev.id) {
        logger.warn('Skipping event with missing fields', { id: ev.id })
        skipped++
        continue
      }

      const firstName = clientName.split(' ')[0] || 'bonjour'
      const startET = toZonedTime(parseISO(ev.start.dateTime), 'America/Toronto')
      const endET = toZonedTime(parseISO(ev.end.dateTime), 'America/Toronto')
      const dateFormatted = format(startET, 'EEEE d MMMM yyyy', { locale: fr })
      const timeFormatted = `${format(startET, 'HH')}h${format(startET, 'mm')} — ${format(endET, 'HH')}h${format(endET, 'mm')}`
      const startTime = `${format(startET, 'HH')}h${format(startET, 'mm')}`

      const service = ev.colorId ? SERVICE_NAME_BY_COLOR[ev.colorId] || 'Séance' : 'Séance'

      // Video séances reuse Chantal's permanent Meet room, stamped on the event
      // at booking time (no per-event conferenceData — see googleCalendar.ts).
      const meetLink = priv.meetLink || undefined

      // Email branch — unchanged from the original task.
      if (emailPending) {
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

          await sendResend(clientEmail, subject, html)

          await calendar.events.patch({
            calendarId,
            eventId: ev.id,
            requestBody: {
              extendedProperties: { private: { reminderSent: '1' } },
            },
          })

          emailSent++
          logger.info('Email reminder sent', { eventId: ev.id, to: clientEmail })
        } catch (err) {
          emailFailed++
          logger.error('Email reminder failed', {
            eventId: ev.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // SMS branch — only when client opted in and we have a phone on file.
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
      emailFailed,
      smsFailed,
    }
  },
})
