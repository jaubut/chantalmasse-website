import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callHandler, errorMessage, freezeNow, loadHandler, setRuntimeConfig } from '../helpers/server'

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

  it('caches a month/service for 5 minutes', async () => {
    const handler = await load()
    await callHandler(handler, { query: { month: '2026-10', service: 'individual' } })
    await callHandler(handler, { query: { month: '2026-10', service: 'individual' } })
    expect(gcal.getEventsForMonth).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(Date.now() + 6 * 60 * 1000))
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
