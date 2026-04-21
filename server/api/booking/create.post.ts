import { getEventsForMonth, createBookingEvent } from '~/server/utils/googleCalendar'
import { clientConfirmationEmail, therapistNotificationEmail } from '~/server/utils/emailTemplates'
import { bookingConfirmationSms, normalizePhone, sendSms } from '~/server/utils/sms'
import { isSlotAvailable } from '~/utils/bookingHelpers'
import { parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

const SERVICE_CONFIG: Record<string, { name: string; colorId: string; durationMinutes: number }> = {
  individual: { name: 'Thérapie Individuelle', colorId: '2', durationMinutes: 60 },
  couple: { name: 'Coaching de Couple', colorId: '7', durationMinutes: 90 },
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate required fields
  const { serviceId, isoStart, isoEnd, sessionType, client } = body

  if (!serviceId || !SERVICE_CONFIG[serviceId]) {
    throw createError({ statusCode: 400, message: 'Service invalide' })
  }
  if (!isoStart || !isoEnd) {
    throw createError({ statusCode: 400, message: 'Créneau horaire requis' })
  }
  if (!['in-person', 'video'].includes(sessionType)) {
    throw createError({ statusCode: 400, message: 'Type de séance invalide' })
  }
  if (!client?.firstName || !client?.lastName || !client?.email) {
    throw createError({ statusCode: 400, message: 'Informations client incomplètes' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
    throw createError({ statusCode: 400, message: 'Adresse courriel invalide' })
  }

  // SMS consent requires a phone number and a valid (normalizable) one.
  const smsConsent = client.smsConsent === true
  const normalizedPhone = normalizePhone(client.phone)
  if (smsConsent && !normalizedPhone) {
    throw createError({
      statusCode: 400,
      message: 'Un numéro de téléphone valide est requis pour les rappels SMS.',
    })
  }

  const serviceConfig = SERVICE_CONFIG[serviceId]
  const slotStart = parseISO(isoStart)
  const year = slotStart.getUTCFullYear()
  const month = slotStart.getUTCMonth() + 1

  // Double-check slot availability (race condition guard)
  let events
  try {
    events = await getEventsForMonth(year, month)
  } catch (err) {
    console.error('[booking/create] Google Calendar fetch error:', err)
    throw createError({
      statusCode: 503,
      message: 'Le système de réservation est temporairement indisponible.',
    })
  }

  if (!isSlotAvailable(isoStart, isoEnd, events)) {
    throw createError({
      statusCode: 409,
      message: 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.',
    })
  }

  // Format dates for display (in ET timezone)
  const startET = toZonedTime(slotStart, 'America/Toronto')
  const endET = toZonedTime(parseISO(isoEnd), 'America/Toronto')
  const dateFormatted = format(startET, "EEEE d MMMM yyyy", { locale: fr })
  const timeFormatted = `${format(startET, 'HH')}h${format(startET, 'mm')} — ${format(endET, 'HH')}h${format(endET, 'mm')}`

  const title = `Séance — ${client.firstName} ${client.lastName}`
  const descriptionParts = [
    `Service: ${serviceConfig.name}`,
    `Format: ${sessionType === 'video' ? 'En visioconférence' : 'En personne — Shefford, QC'}`,
    client.phone ? `Téléphone: ${client.phone}` : null,
    client.message ? `Message: ${client.message}` : null,
  ].filter(Boolean)

  const cancelToken = crypto.randomUUID()
  const config = useRuntimeConfig()

  // Create Google Calendar event
  let createdEvent
  try {
    createdEvent = await createBookingEvent({
      title,
      description: descriptionParts.join('\n'),
      startISO: isoStart,
      endISO: isoEnd,
      sessionType,
      colorId: serviceConfig.colorId,
      clientEmail: client.email,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: normalizedPhone || undefined,
      smsConsent,
      cancelToken,
    })
  } catch (err) {
    console.error('[booking/create] Event creation error:', err)
    throw createError({
      statusCode: 503,
      message: 'Impossible de créer l\'événement. Veuillez réessayer.',
    })
  }

  const meetLink = createdEvent.conferenceData?.entryPoints?.find(
    (ep: any) => ep.entryPointType === 'video',
  )?.uri

  // Send confirmation email to client
  try {
    const clientEmail = clientConfirmationEmail({
      firstName: client.firstName,
      service: serviceConfig.name,
      date: dateFormatted,
      time: timeFormatted,
      sessionType,
      meetLink,
      cancelToken,
    })

    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        from: config.emailFrom,
        to: client.email,
        subject: clientEmail.subject,
        html: clientEmail.html,
      },
    })
  } catch (err) {
    // Don't block booking on email failure — event is already in calendar
    console.error('[booking/create] Client email error:', err)
  }

  // Send notification to therapist
  try {
    const notifEmail = therapistNotificationEmail({
      clientName: `${client.firstName} ${client.lastName}`,
      clientEmail: client.email,
      clientPhone: client.phone,
      service: serviceConfig.name,
      date: dateFormatted,
      time: timeFormatted,
      sessionType,
      message: client.message,
      meetLink,
      eventId: createdEvent.id,
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
        subject: notifEmail.subject,
        html: notifEmail.html,
      },
    })
  } catch (err) {
    console.error('[booking/create] Therapist email error:', err)
  }

  // Confirmation SMS — only when the client explicitly opted in. Failures
  // are logged but don't surface to the user: the calendar event and emails
  // are already through, and a missing SMS shouldn't fail a confirmed booking.
  if (smsConsent && normalizedPhone) {
    try {
      const startTime = `${format(startET, 'HH')}h${format(startET, 'mm')}`
      const body = bookingConfirmationSms({
        firstName: client.firstName,
        dateFormatted,
        startTime,
        sessionType,
        cancelUrl: `${config.siteBaseUrl}/annuler?token=${cancelToken}`,
      })
      await sendSms(normalizedPhone, body)
    } catch (err) {
      console.error('[booking/create] Confirmation SMS error:', err)
    }
  }

  return {
    success: true,
    eventId: createdEvent.id,
    meetLink: meetLink || null,
    cancelToken,
    dateFormatted,
    timeFormatted,
  }
})
