// Lookup of a future booking by its cancel token. Used by /annuler to show
// the user which appointment they're about to cancel before confirming.
// Returns 404 when the token matches no future event — covers unknown
// tokens, already-cancelled bookings, and past appointments.

import { findEventByCancelToken } from '~/server/utils/googleCalendar'
import { parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

const SERVICE_NAME_BY_COLOR: Record<string, string> = {
  '2': 'Thérapie Individuelle',
  '7': 'Coaching de Couple',
}

export default defineEventHandler(async (event) => {
  const token = getQuery(event).token
  if (typeof token !== 'string' || !token.trim()) {
    throw createError({ statusCode: 400, message: 'Token requis' })
  }

  let ev
  try {
    ev = await findEventByCancelToken(token)
  } catch (err) {
    console.error('[booking/cancel-info] calendar lookup error:', err)
    throw createError({
      statusCode: 503,
      message: 'Le système est temporairement indisponible. Veuillez réessayer.',
    })
  }

  if (!ev || !ev.start?.dateTime || !ev.end?.dateTime) {
    throw createError({
      statusCode: 404,
      message: 'Ce lien n\'est plus valide. Le rendez-vous a peut-être déjà été annulé ou est passé.',
    })
  }

  const priv = ev.extendedProperties?.private || {}
  const startET = toZonedTime(parseISO(ev.start.dateTime), 'America/Toronto')
  const endET = toZonedTime(parseISO(ev.end.dateTime), 'America/Toronto')

  const sessionType = priv.sessionType === 'video' ? 'video' : 'in-person'
  const service = ev.colorId ? SERVICE_NAME_BY_COLOR[ev.colorId] || 'Séance' : 'Séance'

  return {
    firstName: (priv.clientName || '').split(' ')[0] || '',
    service,
    sessionType,
    date: format(startET, 'EEEE d MMMM yyyy', { locale: fr }),
    time: `${format(startET, 'HH')}h${format(startET, 'mm')} — ${format(endET, 'HH')}h${format(endET, 'mm')}`,
    startISO: ev.start.dateTime,
  }
})
