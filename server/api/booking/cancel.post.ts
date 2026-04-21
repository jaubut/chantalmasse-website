// Actual cancellation — looks up the event by cancel token, deletes it from
// Chantal's Google Calendar, and sends cancellation notices to both parties.
// All notification channels are best-effort: a failed email/SMS never keeps
// the booking on the calendar. Deleting the event is the only thing that
// matters — the trigger.dev reminder task won't find it on the next scan.

import { findEventByCancelToken, cancelEventById } from '~/server/utils/googleCalendar'
import { clientCancellationEmail, therapistCancellationEmail } from '~/server/utils/emailTemplates'
import { bookingCancellationSms, sendSms } from '~/server/utils/sms'
import { parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

const SERVICE_NAME_BY_COLOR: Record<string, string> = {
  '2': 'Thérapie Individuelle',
  '7': 'Coaching de Couple',
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!token) {
    throw createError({ statusCode: 400, message: 'Token d\'annulation requis' })
  }

  let ev
  try {
    ev = await findEventByCancelToken(token)
  } catch (err) {
    console.error('[booking/cancel] calendar lookup error:', err)
    throw createError({ statusCode: 503, message: 'Système temporairement indisponible.' })
  }

  if (!ev?.id || !ev.start?.dateTime || !ev.end?.dateTime) {
    throw createError({
      statusCode: 404,
      message: 'Ce lien n\'est plus valide. Le rendez-vous a peut-être déjà été annulé.',
    })
  }

  try {
    await cancelEventById(ev.id)
  } catch (err) {
    console.error('[booking/cancel] delete error:', err)
    throw createError({
      statusCode: 503,
      message: 'Impossible de retirer le rendez-vous du calendrier. Veuillez contacter Chantal.',
    })
  }

  // Prepare notification data
  const priv = ev.extendedProperties?.private || {}
  const clientEmail = priv.clientEmail || ''
  const clientName = priv.clientName || ''
  const clientPhone = priv.clientPhone
  const smsConsent = priv.smsConsent === '1'
  const firstName = clientName.split(' ')[0] || ''

  const startET = toZonedTime(parseISO(ev.start.dateTime), 'America/Toronto')
  const endET = toZonedTime(parseISO(ev.end.dateTime), 'America/Toronto')
  const dateFormatted = format(startET, 'EEEE d MMMM yyyy', { locale: fr })
  const timeFormatted = `${format(startET, 'HH')}h${format(startET, 'mm')} — ${format(endET, 'HH')}h${format(endET, 'mm')}`
  const startTime = `${format(startET, 'HH')}h${format(startET, 'mm')}`
  const service = ev.colorId ? SERVICE_NAME_BY_COLOR[ev.colorId] || 'Séance' : 'Séance'

  const config = useRuntimeConfig()

  // Client confirmation email — best-effort
  if (clientEmail) {
    try {
      const mail = clientCancellationEmail({ firstName, service, date: dateFormatted, time: timeFormatted })
      await $fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          from: config.emailFrom,
          to: clientEmail,
          subject: mail.subject,
          html: mail.html,
        },
      })
    } catch (err) {
      console.error('[booking/cancel] client email error:', err)
    }
  }

  // Therapist notification email
  try {
    const mail = therapistCancellationEmail({
      clientName,
      clientEmail,
      clientPhone,
      service,
      date: dateFormatted,
      time: timeFormatted,
    })
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        from: config.emailFrom,
        to: config.emailTo,
        subject: mail.subject,
        html: mail.html,
      },
    })
  } catch (err) {
    console.error('[booking/cancel] therapist email error:', err)
  }

  // Client cancellation SMS — same consent gate as the confirmation
  if (smsConsent && clientPhone) {
    try {
      await sendSms(clientPhone, bookingCancellationSms({ firstName, dateFormatted, startTime }))
    } catch (err) {
      console.error('[booking/cancel] client SMS error:', err)
    }
  }

  return {
    success: true,
    message: 'Votre rendez-vous a été annulé.',
    date: dateFormatted,
    time: timeFormatted,
  }
})
