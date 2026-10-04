import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, makeCalendar, routeFetch } from '../helpers/trigger'

const calendar = vi.hoisted(() => ({ ref: null as unknown }))
const twilio = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('@trigger.dev/sdk/v3', async () => (await import('../helpers/trigger')).triggerSdkMock())
vi.mock('googleapis', async () => (await import('../helpers/trigger')).googleapisMock(() => calendar.ref as never))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: twilio.create } }) }))

const RESEND = 'https://api.resend.com/emails'

type RunResult = Record<string, number>

async function loadTask() {
  calendar.ref = makeCalendar()
  vi.resetModules()
  const mod = await import('~/trigger/booking-reminder')
  return {
    task: mod.bookingReminder as unknown as { run: (p: unknown, c: { ctx: unknown }) => Promise<RunResult> },
    cal: calendar.ref as ReturnType<typeof makeCalendar>,
  }
}

function formBooking(priv: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    colorId: '2',
    summary: 'Séance — Marie Tremblay',
    start: { dateTime: '2026-10-07T13:00:00Z' },
    end: { dateTime: '2026-10-07T14:00:00Z' },
    extendedProperties: { private: {
      clientEmail: 'marie@example.com', clientName: 'Marie Tremblay', cancelToken: 'tok-1',
      sessionType: 'in-person', reminderSent: '0', ...priv,
    } },
    ...extra,
  }
}

describe('trigger: booking-reminder', () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'ci@example.iam.gserviceaccount.com',
      GOOGLE_PRIVATE_KEY: 'dummy',
      GOOGLE_CALENDAR_ID: 'calendar@example.com',
      RESEND_API_KEY: 're_test_dummy',
      EMAIL_FROM: 'reservations@example.com',
      TWILIO_ACCOUNT_SID: 'ACdummy',
      TWILIO_AUTH_TOKEN: 'dummy',
      TWILIO_FROM_NUMBER: '+15005550006',
    })) vi.stubEnv(k, v)
    vi.useFakeTimers({ now: new Date('2026-10-06T13:00:00Z'), toFake: ['Date'] })
    twilio.create.mockResolvedValue({ sid: 'SM1' })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

  it('refuses to run without its credentials', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { task } = await loadTask()
    await expect(task.run({}, { ctx: {} })).rejects.toThrow(/RESEND_API_KEY/)
  })

  it('emails a form booking 24h ahead and flags it as sent', async () => {
    const { task, cal } = await loadTask()
    cal.events.list.mockResolvedValue({ data: { items: [formBooking()] } })
    const mails: Array<Record<string, string>> = []
    routeFetch({ [RESEND]: (init) => { mails.push(JSON.parse(String(init.body))); return jsonResponse({ id: 'r' }) } })

    const result = await task.run({}, { ctx: {} })

    expect(result).toMatchObject({ scanned: 1, emailSent: 1, smsSent: 0, emailFailed: 0 })
    expect(mails).toHaveLength(1)
    expect(mails[0]!.to).toBe('marie@example.com')
    expect(cal.events.patch).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'e1',
      requestBody: { extendedProperties: { private: { reminderSent: '1' } } },
    }))
    expect(twilio.create).not.toHaveBeenCalled()
  })

  it('texts opted-in clients with the cancel link', async () => {
    const { task, cal } = await loadTask()
    cal.events.list.mockResolvedValue({ data: { items: [formBooking({ reminderSent: '1', smsConsent: '1', smsReminderSent: '0', clientPhone: '+14505551234' })] } })
    routeFetch({})
    const result = await task.run({}, { ctx: {} })
    expect(result).toMatchObject({ emailSent: 0, smsSent: 1 })
    expect(twilio.create).toHaveBeenCalledWith(expect.objectContaining({ to: '+14505551234' }))
    expect(twilio.create.mock.calls[0]![0].body).toContain('https://chantalmasse.com/annuler?token=tok-1')
  })

  it('emails manual calendar bookings via the guest, but never guests of personal events', async () => {
    const { task, cal } = await loadTask()
    cal.events.list.mockResolvedValue({ data: { items: [
      { id: 'm1', summary: 'Thérapie - Julie Roy', start: { dateTime: '2026-10-07T13:00:00Z' }, end: { dateTime: '2026-10-07T14:00:00Z' },
        attendees: [{ email: 'calendar@example.com', self: true }, { email: 'julie@example.com' }] },
      { id: 'p1', summary: 'Souper famille', start: { dateTime: '2026-10-07T22:00:00Z' }, end: { dateTime: '2026-10-07T23:00:00Z' },
        attendees: [{ email: 'cousin@example.com' }] },
    ] } })
    const to: string[] = []
    routeFetch({ [RESEND]: (init) => { to.push(JSON.parse(String(init.body)).to); return jsonResponse({ id: 'r' }) } })
    const result = await task.run({}, { ctx: {} })
    expect(to).toEqual(['julie@example.com'])
    expect(result).toMatchObject({ emailSent: 1 })
  })

  it('isolates failures: a Resend error does not stop the SMS', async () => {
    const { task, cal } = await loadTask()
    cal.events.list.mockResolvedValue({ data: { items: [formBooking({ smsConsent: '1', smsReminderSent: '0', clientPhone: '4505551234' })] } })
    routeFetch({ [RESEND]: () => new Response('nope', { status: 500 }) })
    const result = await task.run({}, { ctx: {} })
    expect(result).toMatchObject({ emailSent: 0, emailFailed: 1, smsSent: 1 })
    expect(cal.events.patch).toHaveBeenCalledTimes(1)
  })
})
