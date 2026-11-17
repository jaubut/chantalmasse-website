import { getMonthBusy } from '~/server/utils/bookingCache'
import { getAvailableDatesInMonth } from '~/utils/bookingHelpers'
import { addDays, endOfMonth, isAfter, isBefore, startOfMonth } from 'date-fns'

const SERVICE_DURATIONS: Record<string, number> = {
  individual: 60,
  couple: 90,
}

// Slot math costs ~50 ms of CPU; reuse it while the isolate sees the same
// calendar snapshot within the same minute (the 24 h notice moves with time).
const computed = new Map<string, { stamp: string; slots: ReturnType<typeof getAvailableDatesInMonth> }>()

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

  const [year, monthNum] = month.split('-').map(Number)
  const durationMinutes = SERVICE_DURATIONS[service]

  const config = useRuntimeConfig()
  const advanceDays = parseInt(config.public.bookingAdvanceDays as string, 10) || 60
  const minNoticeHours = parseInt(config.bookingMinNoticeHours as string, 10) || 24
  const requestedMonthStart = startOfMonth(new Date(year, monthNum - 1, 1))
  const currentMonthStart = startOfMonth(new Date())
  const maxMonthEnd = endOfMonth(addDays(new Date(), advanceDays))

  // Do not let arbitrary month probes fan out to Google Calendar. The UI only
  // exposes the current booking window, and requests outside that window have
  // no useful availability to return.
  if (isBefore(requestedMonthStart, currentMonthStart) || isAfter(requestedMonthStart, maxMonthEnd)) {
    return {
      month,
      service,
      availableDates: [],
      slotsByDate: {},
    }
  }

  const t0 = Date.now()
  let busy: Awaited<ReturnType<typeof getMonthBusy>>
  try {
    busy = await getMonthBusy(event, year, monthNum)
  } catch (err) {
    console.error('[booking/availability] Google Calendar error:', err)
    throw createError({
      statusCode: 503,
      message: 'Le système de réservation est temporairement indisponible. Écris-moi directement à chantal.gmasse@gmail.com',
    })
  }

  const memoKey = `${month}:${service}`
  const stamp = `${busy.fetchedAt}:${Math.floor(Date.now() / 60_000)}`
  let memo = computed.get(memoKey)
  if (memo?.stamp !== stamp) {
    memo = {
      stamp,
      slots: getAvailableDatesInMonth(year, monthNum, durationMinutes, busy.events, advanceDays, minNoticeHours),
    }
    computed.set(memoKey, memo)
  }

  setHeader(event, 'server-timing', `busy;dur=${Date.now() - t0};desc="${busy.status}"`)

  return {
    month,
    service,
    availableDates: memo.slots.availableDates,
    slotsByDate: memo.slots.slotsByDate,
  }
})
