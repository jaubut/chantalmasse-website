import { schedules, logger } from '@trigger.dev/sdk/v3'
import { getEventsForMonth } from '../server/utils/googleCalendar'
import { reviewRequestEmail } from '../server/utils/emailTemplates'
import { subDays, parseISO, format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

const GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJf0hxfazRyUwRzgp46r7fzIQ'

/**
 * Post-session review request for Chantal Massé.
 * Runs daily at 10:00 AM ET — finds sessions that happened 48 hours ago
 * and sends a gentle review request email to the client.
 *
 * Privacy-conscious: therapy clients need a soft, optional ask.
 * The email makes it clear this is 100% optional and can be anonymous.
 *
 * Required env vars:
 *   RESEND_API_KEY
 *   EMAIL_FROM
 */
export const reviewRequest = schedules.task({
  id: 'chantalmasse-review-request',
  cron: {
    pattern: '0 10 * * *', // Daily at 10:00 AM
    timezone: 'America/Toronto',
  },
  maxDuration: 60,
  run: async (payload) => {
    logger.info('Starting review request check', { scheduledAt: payload.timestamp })

    const now = toZonedTime(new Date(), 'America/Toronto')
    const targetDate = subDays(now, 2) // Sessions from 48h ago
    const targetYear = targetDate.getFullYear()
    const targetMonth = targetDate.getMonth() + 1

    // Fetch all events for that month
    let events: any[]
    try {
      events = await getEventsForMonth(targetYear, targetMonth)
    } catch (err) {
      logger.error('Failed to fetch calendar events', { error: String(err) })
      throw err
    }

    // Filter: sessions that started on the target date
    const targetStart = startOfDay(targetDate)
    const targetEnd = endOfDay(targetDate)

    const completedSessions = events.filter((event) => {
      if (!event.start?.dateTime) return false
      const eventStart = toZonedTime(parseISO(event.start.dateTime), 'America/Toronto')
      return isWithinInterval(eventStart, { start: targetStart, end: targetEnd })
    })

    logger.info('Found completed sessions', {
      targetDate: format(targetDate, 'yyyy-MM-dd'),
      count: completedSessions.length,
    })

    if (completedSessions.length === 0) {
      return { success: true, emailsSent: 0, reason: 'No sessions on target date' }
    }

    let emailsSent = 0

    for (const session of completedSessions) {
      // Extract client info from event description
      const description = session.description || ''
      const summary = session.summary || ''

      // Parse client name from event title: "Séance — FirstName LastName"
      const nameMatch = summary.match(/Séance — (.+)/)
      if (!nameMatch) {
        logger.warn('Skipping event — no client name in title', { summary })
        continue
      }

      const fullName = nameMatch[1].trim()
      const firstName = fullName.split(' ')[0]

      // Extract email from attendees or description
      let clientEmail: string | null = null

      // Check attendees
      if (session.attendees) {
        const clientAttendee = session.attendees.find(
          (a: any) => a.email && !a.email.includes('chantal'),
        )
        if (clientAttendee) clientEmail = clientAttendee.email
      }

      // Fallback: check description for email pattern
      if (!clientEmail) {
        const emailMatch = description.match(/[\w.-]+@[\w.-]+\.\w+/)
        if (emailMatch) clientEmail = emailMatch[0]
      }

      if (!clientEmail) {
        logger.warn('Skipping event — no client email found', { summary })
        continue
      }

      // Extract service type from description
      const serviceMatch = description.match(/Service:\s*(.+)/)
      const service = serviceMatch ? serviceMatch[1].trim() : 'votre séance'

      // Format the session date for the email
      const sessionStart = toZonedTime(parseISO(session.start.dateTime), 'America/Toronto')
      const dateFormatted = format(sessionStart, "d MMMM", { locale: fr })

      // Send review request
      try {
        const email = reviewRequestEmail({
          firstName,
          service,
          date: dateFormatted,
          reviewUrl: GOOGLE_REVIEW_URL,
        })

        await $fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: {
            from: process.env.EMAIL_FROM,
            to: clientEmail,
            subject: email.subject,
            html: email.html,
          },
        })

        emailsSent++
        logger.info('Review request sent', { to: clientEmail, firstName })
      } catch (err) {
        logger.error('Failed to send review request', {
          to: clientEmail,
          error: String(err),
        })
      }
    }

    return {
      success: true,
      sessionsFound: completedSessions.length,
      emailsSent,
    }
  },
})
