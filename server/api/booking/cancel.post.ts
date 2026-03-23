// Phase 2 stub — cancellation by token
// In a future implementation, store cancelToken → eventId mapping in a database
// and use the Google Calendar API to cancel the event.

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token } = body

  if (!token) {
    throw createError({ statusCode: 400, message: 'Token d\'annulation requis' })
  }

  // TODO (phase 2):
  // 1. Look up eventId by token in database
  // 2. Call calendar.events.delete({ calendarId, eventId })
  // 3. Send cancellation confirmation emails
  // 4. Mark token as used

  return {
    success: false,
    message: 'La fonctionnalité d\'annulation en ligne sera disponible prochainement. Veuillez contacter chantal@chantalmasse.com pour annuler votre rendez-vous.',
  }
})
