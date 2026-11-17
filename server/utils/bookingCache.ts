// Busy times per month in Workers KV (binding BOOKING_CACHE), shared by every
// isolate and colo so most availability calls never wait on Google. Display
// only: create.post.ts always re-reads Google live before inserting an event.
import type { H3Event } from 'h3'
import { getEventsForMonth } from './googleCalendar'
import type { CalendarEvent } from '~/utils/bookingHelpers'

export interface BookingKv {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

const FRESH_MS = 60_000
// Older than FRESH but younger than this → served at once, refreshed in the background.
const STALE_MS = 5 * 60_000
// Kept this long so a Google outage still shows the last known calendar.
const KEEP_SECONDS = 3600

interface CachedMonth { fetchedAt: number; events: CalendarEvent[] }

export type CacheStatus = 'hit' | 'stale' | 'miss' | 'fallback' | 'off'

// Nitro's cloudflare_module preset exposes the Worker env on globalThis.__env__.
export function bookingKv(): BookingKv | undefined {
  return (globalThis as { __env__?: { BOOKING_CACHE?: BookingKv } }).__env__?.BOOKING_CACHE
}

const monthKey = (year: number, month: number) => `busy:${year}-${String(month).padStart(2, '0')}`

export async function getMonthBusy(
  event: H3Event,
  year: number,
  month: number,
): Promise<{ events: CalendarEvent[]; fetchedAt: number; status: CacheStatus }> {
  const kv = bookingKv()
  if (!kv) return { events: await getEventsForMonth(year, month), fetchedAt: Date.now(), status: 'off' }

  const key = monthKey(year, month)
  const cached = (await kv.get(key, 'json').catch(() => null)) as CachedMonth | null
  const age = cached ? Date.now() - cached.fetchedAt : Infinity

  if (cached && age < FRESH_MS) return { ...cached, status: 'hit' }
  if (cached && age < STALE_MS) {
    const refresh = refreshMonth(kv, key, year, month)
      .catch(err => console.error('[bookingCache] background refresh failed:', err))
    event.waitUntil?.(refresh)
    return { ...cached, status: 'stale' }
  }
  try {
    return { ...(await refreshMonth(kv, key, year, month)), status: 'miss' }
  } catch (err) {
    if (!cached) throw err
    console.error('[bookingCache] Google failed, serving cached month:', err)
    return { ...cached, status: 'fallback' }
  }
}

async function refreshMonth(kv: BookingKv, key: string, year: number, month: number): Promise<CachedMonth> {
  const items = await getEventsForMonth(year, month)
  // Bounds only: titles and client details never land in KV.
  const events = items.map(e => ({
    start: { dateTime: e.start?.dateTime, date: e.start?.date },
    end: { dateTime: e.end?.dateTime, date: e.end?.date },
  }))
  // ponytail: KV allows 1 write/s per key and 1k writes/day on the free plan; a
  // failed put only costs the next request a live Google read.
  const fresh = { fetchedAt: Date.now(), events }
  await kv.put(key, JSON.stringify(fresh), { expirationTtl: KEEP_SECONDS })
    .catch(err => console.error('[bookingCache] KV write failed:', err))
  return fresh
}

// After a booking or cancellation made through the site. Never throws: the
// calendar is already changed, and the cache expires within a minute anyway.
export async function invalidateMonth(year: number, month: number): Promise<void> {
  await bookingKv()?.delete(monthKey(year, month))
    .catch(err => console.error('[bookingCache] invalidate failed:', err))
}
