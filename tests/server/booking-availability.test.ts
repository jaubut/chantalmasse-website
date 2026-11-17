import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callHandler, errorMessage, freezeNow, installKv, loadHandler, setRuntimeConfig, uninstallKv } from '../helpers/server'

const gcal = vi.hoisted(() => ({ getEventsForMonth: vi.fn() }))
vi.mock('~/server/utils/googleCalendar', () => gcal)

const load = () => loadHandler('~/server/api/booking/availability.get')

// Monday 2026-10-05, 08:00 in Shefford (EDT).
const NOW = '2026-10-05T12:00:00Z'

describe('GET /api/booking/availability', () => {
  beforeEach(() => {
    setRuntimeConfig()
    freezeNow(NOW)
    gcal.getEventsForMonth.mockResolvedValue([])
  })
  afterEach(() => { vi.useRealTimers() })

  it.each([
    [{ service: 'individual' }],
    [{ month: '2026-1', service: 'individual' }],
    [{ month: 'octobre', service: 'individual' }],
  ])('rejects a bad month (%j) with 400', async (query) => {
    const res = await callHandler(await load(), { query })
    expect(res.status).toBe(400)
    expect(errorMessage(res)).toMatch(/month invalide/)
  })

  it.each(['', 'group', 'INDIVIDUAL'])('rejects a bad service %j with 400', async (service) => {
    const res = await callHandler(await load(), { query: { month: '2026-10', service } })
    expect(res.status).toBe(400)
    expect(errorMessage(res)).toMatch(/service invalide/)
  })

  it.each(['2026-09', '2027-06'])('returns empty availability outside the booking window (%s) without calling Google', async (month) => {
    const res = await callHandler(await load(), { query: { month, service: 'individual' } })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ month, service: 'individual', availableDates: [], slotsByDate: {} })
    expect(gcal.getEventsForMonth).not.toHaveBeenCalled()
  })

  it('returns working days only, honouring the 24h minimum notice', async () => {
    const res = await callHandler(await load(), { query: { month: '2026-10', service: 'individual' } })
    expect(res.status).toBe(200)
    expect(gcal.getEventsForMonth).toHaveBeenCalledWith(2026, 10)
    expect(res.json.availableDates).toEqual([
      '2026-10-06', '2026-10-07', '2026-10-08',
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    ])
    const tuesday = res.json.slotsByDate['2026-10-13']
    expect(tuesday[0]).toEqual({
      isoStart: '2026-10-13T13:00:00.000Z',
      isoEnd: '2026-10-13T14:00:00.000Z',
      label: '09h00 — 10h00',
    })
    expect(tuesday.at(-1).label).toBe('17h30 — 18h30')
  })

  it('uses 90-minute slots for couple coaching', async () => {
    const res = await callHandler(await load(), { query: { month: '2026-10', service: 'couple' } })
    const wednesday = res.json.slotsByDate['2026-10-14']
    expect(wednesday[0].label).toBe('09h00 — 10h30')
    expect(wednesday.at(-1).label).toBe('15h30 — 17h00')
  })

  it('removes slots that clash with existing calendar events (15 min buffer)', async () => {
    gcal.getEventsForMonth.mockResolvedValue([
      { start: { dateTime: '2026-10-13T12:00:00-04:00' }, end: { dateTime: '2026-10-13T13:00:00-04:00' } },
    ])
    const res = await callHandler(await load(), { query: { month: '2026-10', service: 'individual' } })
    const labels: string[] = res.json.slotsByDate['2026-10-13'].map((s: { label: string }) => s.label)
    expect(labels).toContain('10h45 — 11h45')
    expect(labels).not.toContain('11h00 — 12h00')
    expect(labels).not.toContain('13h00 — 14h00')
    expect(labels).toContain('13h15 — 14h15')
  })

  it('without a KV binding reads Google on every call', async () => {
    const handler = await load()
    await callHandler(handler, { query: { month: '2026-10', service: 'individual' } })
    await callHandler(handler, { query: { month: '2026-10', service: 'individual' } })
    expect(gcal.getEventsForMonth).toHaveBeenCalledTimes(2)
  })

  it('returns a French 503 when Google Calendar fails', async () => {
    gcal.getEventsForMonth.mockRejectedValue(new Error('invalid_grant'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await callHandler(await load(), { query: { month: '2026-10', service: 'individual' } })
    expect(res.status).toBe(503)
    expect(errorMessage(res)).toMatch(/temporairement indisponible/)
  })
})

describe('GET /api/booking/availability — KV busy-times cache', () => {
  const OCT = { month: '2026-10', service: 'individual' }
  const BUSY_13_OCT = {
    summary: 'Séance — Marie Tremblay',
    start: { dateTime: '2026-10-13T09:00:00-04:00' },
    end: { dateTime: '2026-10-13T10:00:00-04:00' },
  }
  const firstLabel13 = (res: { json: Record<string, any> }) => res.json.slotsByDate['2026-10-13'][0].label
  const advance = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms))
  let kv: ReturnType<typeof installKv>

  beforeEach(() => {
    setRuntimeConfig()
    freezeNow(NOW)
    kv = installKv()
    gcal.getEventsForMonth.mockResolvedValue([BUSY_13_OCT])
  })
  afterEach(() => { vi.useRealTimers(); uninstallKv() })

  it('miss → reads Google once, stores only event bounds, then serves both services from KV', async () => {
    const handler = await load()
    const miss = await callHandler(handler, { query: OCT })
    expect(miss.headers.get('server-timing')).toMatch(/desc="miss"/)
    expect(kv.store.get('busy:2026-10')).not.toMatch(/Marie|Séance/)

    const hit = await callHandler(handler, { query: OCT })
    const couple = await callHandler(handler, { query: { month: '2026-10', service: 'couple' } })
    expect(hit.headers.get('server-timing')).toMatch(/desc="hit"/)
    expect(couple.status).toBe(200)
    expect(gcal.getEventsForMonth).toHaveBeenCalledTimes(1)
    expect(firstLabel13(hit)).toBe('10h15 — 11h15')
  })

  it('stale (1–5 min) → answers from KV at once and refreshes in the background', async () => {
    const handler = await load()
    await callHandler(handler, { query: OCT })
    gcal.getEventsForMonth.mockResolvedValue([])
    advance(2 * 60_000)

    const stale = await callHandler(handler, { query: OCT })
    expect(stale.headers.get('server-timing')).toMatch(/desc="stale"/)
    expect(firstLabel13(stale)).toBe('10h15 — 11h15')
    await vi.waitFor(() => expect(JSON.parse(kv.store.get('busy:2026-10')!).events).toEqual([]))
    expect(gcal.getEventsForMonth).toHaveBeenCalledTimes(2)

    const fresh = await callHandler(handler, { query: OCT })
    expect(fresh.headers.get('server-timing')).toMatch(/desc="hit"/)
    expect(firstLabel13(fresh)).toBe('09h00 — 10h00')
  })

  it('older than 5 min → waits for Google again', async () => {
    const handler = await load()
    await callHandler(handler, { query: OCT })
    gcal.getEventsForMonth.mockResolvedValue([])
    advance(6 * 60_000)
    const res = await callHandler(handler, { query: OCT })
    expect(res.headers.get('server-timing')).toMatch(/desc="miss"/)
    expect(firstLabel13(res)).toBe('09h00 — 10h00')
  })

  it('Google down → serves the last cached month instead of a 503', async () => {
    const handler = await load()
    await callHandler(handler, { query: OCT })
    gcal.getEventsForMonth.mockRejectedValue(new Error('Google Calendar API error (500)'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    advance(30 * 60_000)
    const res = await callHandler(handler, { query: OCT })
    expect(res.status).toBe(200)
    expect(res.headers.get('server-timing')).toMatch(/desc="fallback"/)
    expect(firstLabel13(res)).toBe('10h15 — 11h15')
  })

  it('Google down with nothing cached → French 503', async () => {
    gcal.getEventsForMonth.mockRejectedValue(new Error('invalid_grant'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await callHandler(await load(), { query: OCT })
    expect(res.status).toBe(503)
  })

  it('a KV outage falls back to Google', async () => {
    kv.get.mockRejectedValue(new Error('KV unavailable'))
    kv.put.mockRejectedValue(new Error('KV unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await callHandler(await load(), { query: OCT })
    expect(res.status).toBe(200)
    expect(firstLabel13(res)).toBe('10h15 — 11h15')
  })

  it('invalidateMonth drops the month so the next call reads Google', async () => {
    const handler = await load()
    await callHandler(handler, { query: OCT })
    const { invalidateMonth } = await import('~/server/utils/bookingCache')
    await invalidateMonth(2026, 10)
    expect(kv.store.has('busy:2026-10')).toBe(false)
    await callHandler(handler, { query: OCT })
    expect(gcal.getEventsForMonth).toHaveBeenCalledTimes(2)
  })
})
