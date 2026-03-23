import { getEventsForMonth } from '~/server/utils/googleCalendar'
import { getAvailableDatesInMonth } from '~/utils/bookingHelpers'

const SERVICE_DURATIONS: Record<string, number> = {
  individual: 60,
  couple: 90,
}

// In-memory cache: key = "YYYY-MM:service", value = { data, expiresAt }
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const month = query.month as string // "YYYY-MM"
  const service = query.service as string // "individual" | "couple"

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw createError({ statusCode: 400, message: 'Paramètre month invalide (format YYYY-MM requis)' })
  }

  if (!service || !SERVICE_DURATIONS[service]) {
    throw createError({ statusCode: 400, message: 'Paramètre service invalide (individual ou couple)' })
  }

  const cacheKey = `${month}:${service}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  const [year, monthNum] = month.split('-').map(Number)
  const durationMinutes = SERVICE_DURATIONS[service]

  const config = useRuntimeConfig()
  const advanceDays = parseInt(config.public.bookingAdvanceDays as string, 10) || 60
  const minNoticeHours = parseInt(config.bookingMinNoticeHours as string, 10) || 24

  let events: Awaited<ReturnType<typeof getEventsForMonth>>
  try {
    events = await getEventsForMonth(year, monthNum)
  } catch (err) {
    console.error('[booking/availability] Google Calendar error:', err)
    throw createError({
      statusCode: 503,
      message: 'Le système de réservation est temporairement indisponible. Contactez-nous directement à chantal@chantalmasse.com',
    })
  }

  const result = getAvailableDatesInMonth(
    year,
    monthNum,
    durationMinutes,
    events,
    advanceDays,
    minNoticeHours,
  )

  const response = {
    month,
    service,
    availableDates: result.availableDates,
    slotsByDate: result.slotsByDate,
  }

  cache.set(cacheKey, { data: response, expiresAt: Date.now() + CACHE_TTL_MS })

  return response
})
