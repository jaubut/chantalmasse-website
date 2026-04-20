import { schedules, logger } from '@trigger.dev/sdk/v3'
import { google } from 'googleapis'
import { parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { clientReminderEmail } from '../server/utils/emailTemplates'

/**
 * Hourly scan for bookings starting in ~24h; sends a Resend reminder email.
 *
 * Window: events starting between now+23h and now+25h, where extendedProperties.private.reminderSent === "0".
 * Dedup: after sending, patches the event to reminderSent="1".
 *
 * This task is standalone — it does not use nuxt's useRuntimeConfig().
 * Required env vars (set in Trigger.dev dashboard):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY          (keep literal \n escapes)
 *   GOOGLE_CALENDAR_ID
 *   RESEND_API_KEY
 *   EMAIL_FROM
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
      privateExtendedProperty: ['reminderSent=0'],
    })

    const events = listRes.data.items || []
    logger.info(`Found ${events.length} event(s) due for reminder`)

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const ev of events) {
      try {
        const priv = ev.extendedProperties?.private || {}
        const clientEmail = priv.clientEmail
        const clientName = priv.clientName || ''
        const cancelToken = priv.cancelToken || ''
        const sessionType = (priv.sessionType === 'video' ? 'video' : 'in-person') as
          | 'video'
          | 'in-person'

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

        const service = ev.colorId ? SERVICE_NAME_BY_COLOR[ev.colorId] || 'Séance' : 'Séance'

        const meetLink =
          ev.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
          undefined

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

        sent++
        logger.info('Reminder sent', { eventId: ev.id, to: clientEmail })
      } catch (err) {
        failed++
        logger.error('Reminder failed for event', {
          eventId: ev.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return { scanned: events.length, sent, skipped, failed }
  },
})
