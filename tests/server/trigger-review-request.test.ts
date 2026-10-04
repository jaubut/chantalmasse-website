import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, makeCalendar, routeFetch } from '../helpers/trigger'

const calendar = vi.hoisted(() => ({ ref: null as unknown }))
vi.mock('@trigger.dev/sdk/v3', async () => (await import('../helpers/trigger')).triggerSdkMock())
vi.mock('googleapis', async () => (await import('../helpers/trigger')).googleapisMock(() => calendar.ref as never))

const TURSO = 'https://chantal-test.turso.io/v2/pipeline'
const RESEND = 'https://api.resend.com/emails'

type Row = { last_requested_at: string; opt_out: string } | null

/** Turso pipeline double: SELECT returns `rows[email]`, INSERT is recorded. */
function tursoRoute(rows: Record<string, Row>, writes: string[]) {
  return (init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    const stmt = body.requests[0].stmt
    const email = stmt.args[0].value as string
    if (stmt.sql.startsWith('SELECT')) {
      const row = rows[email]
      return jsonResponse({
        results: [{
          type: 'ok',
          response: { result: {
            cols: [{ name: 'last_requested_at' }, { name: 'opt_out' }],
            rows: row ? [[{ type: 'text', value: row.last_requested_at }, { type: 'text', value: row.opt_out }]] : [],
          } },
        }],
      })
    }
    writes.push(email)
    return jsonResponse({ results: [{ type: 'ok', response: { result: { cols: [], rows: [] } } }] })
  }
}

function pastEvent(id: string, email: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    summary: 'Séance',
    start: { dateTime: '2026-10-03T14:00:00Z' },
    extendedProperties: { private: { clientEmail: email, clientName: 'Marie <b>Tremblay</b>' } },
    ...extra,
  }
}

async function loadTask() {
  calendar.ref = makeCalendar()
  vi.resetModules()
  const mod = await import('~/trigger/review-request')
  return { task: mod.reviewRequest as unknown as { run: (p: { timestamp: Date }) => Promise<Record<string, number>> }, cal: calendar.ref as ReturnType<typeof makeCalendar> }
}

describe('trigger: review-request', () => {
  beforeEach(() => {
    vi.stubEnv('TURSO_DATABASE_URL', 'libsql://chantal-test.turso.io')
    vi.stubEnv('TURSO_AUTH_TOKEN', 'dummy')
    vi.stubEnv('RESEND_API_KEY', 're_test_dummy')
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'calendar@example.com')
    vi.useFakeTimers({ now: new Date('2026-10-06T14:00:00Z'), toFake: ['Date'] })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

  it('asks for a review once, records it in Turso and stamps the event', async () => {
    const { task, cal } = await loadTask()
    cal.events.list.mockResolvedValue({ data: { items: [pastEvent('e1', 'Marie@Example.com')] } })
    const writes: string[] = []
    const sent: Array<Record<string, unknown>> = []
    routeFetch({
      [TURSO]: tursoRoute({}, writes),
      [RESEND]: (init) => { sent.push(JSON.parse(String(init.body))); return jsonResponse({ id: 'r1' }) },
    })

    const result = await task.run({ timestamp: new Date() })

    expect(result).toEqual({ scanned: 1, sent: 1, skipped: 0, failed: 0 })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.to).toEqual(['marie@example.com'])
    expect(sent[0]!.html).toContain('Bonjour Marie,')
    expect(sent[0]!.html).toContain('search.google.com/local/writereview')
    expect(writes).toEqual(['marie@example.com'])
    expect(cal.events.patch).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1' }))
    // Scans the 48–72h window.
    const listArgs = cal.events.list.mock.calls[0]![0]
    expect(listArgs.timeMin).toBe('2026-10-03T14:00:00.000Z')
    expect(listArgs.timeMax).toBe('2026-10-04T14:00:00.000Z')
  })

  it('skips opted-out clients, recent asks, cancelled and already-stamped events', async () => {
    const { task, cal } = await loadTask()
    cal.events.list.mockResolvedValue({ data: { items: [
      pastEvent('e1', 'optout@example.com'),
      pastEvent('e2', 'recent@example.com'),
      pastEvent('e3', 'cancel@example.com', { status: 'cancelled' }),
      pastEvent('e4', 'stamped@example.com', { extendedProperties: { private: { clientEmail: 'stamped@example.com', reviewRequestedAt: 'x' } } }),
      pastEvent('e5', 'old@example.com'),
      { id: 'e6', start: { dateTime: '2026-10-03T14:00:00Z' }, summary: 'Bloc perso' },
    ] } })
    const writes: string[] = []
    const sentTo: string[] = []
    routeFetch({
      [TURSO]: tursoRoute({
        'optout@example.com': { last_requested_at: '2025-01-01 00:00:00', opt_out: '1' },
        'recent@example.com': { last_requested_at: '2026-09-01 00:00:00', opt_out: '0' },
        'old@example.com': { last_requested_at: '2026-01-01 00:00:00', opt_out: '0' },
      }, writes),
      [RESEND]: (init) => { sentTo.push(...JSON.parse(String(init.body)).to); return jsonResponse({ id: 'r' }) },
    })

    const result = await task.run({ timestamp: new Date() })

    expect(result).toEqual({ scanned: 3, sent: 1, skipped: 2, failed: 0 })
    expect(sentTo).toEqual(['old@example.com'])
  })

  it('counts a provider failure without stamping the event or recording the ask', async () => {
    const { task, cal } = await loadTask()
    cal.events.list.mockResolvedValue({ data: { items: [pastEvent('e1', 'marie@example.com')] } })
    const writes: string[] = []
    routeFetch({
      [TURSO]: tursoRoute({}, writes),
      [RESEND]: () => jsonResponse({ message: 'domain not verified' }, 403),
    })
    const result = await task.run({ timestamp: new Date() })
    expect(result).toEqual({ scanned: 1, sent: 0, skipped: 0, failed: 1 })
    expect(writes).toEqual([])
    expect(cal.events.patch).not.toHaveBeenCalled()
  })
})

