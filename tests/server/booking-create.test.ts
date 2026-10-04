import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callHandler, errorMessage, fetchMock, freezeNow, loadHandler, setRuntimeConfig } from '../helpers/server'

const gcal = vi.hoisted(() => ({
  getEventsForMonth: vi.fn(),
  createBookingEvent: vi.fn(),
}))
const sms = vi.hoisted(() => ({ sendSms: vi.fn() }))

vi.mock('~/server/utils/googleCalendar', () => gcal)
vi.mock('~/server/utils/sms', async (importOriginal) => {
  const real = await importOriginal<typeof import('~/server/utils/sms')>()
  return { ...real, sendSms: sms.sendSms }
})

const load = () => loadHandler('~/server/api/booking/create.post')

// Monday 2026-10-05 08:00 EDT. Tuesday 13 Oct 09:00 EDT is a free slot.
const NOW = '2026-10-05T12:00:00Z'
const SLOT = { isoStart: '2026-10-13T13:00:00.000Z', isoEnd: '2026-10-13T14:00:00.000Z' }

function validBody(overrides: Record<string, unknown> = {}, client: Record<string, unknown> = {}) {
  return {
    serviceId: 'individual',
    sessionType: 'in-person',
    ...SLOT,
    metaEventId: 'evt_123',
    client: { firstName: 'Marie', lastName: 'Tremblay', email: 'Marie@Example.com', ...client },
    ...overrides,
  }
}

describe('POST /api/booking/create', () => {
  beforeEach(() => {
    setRuntimeConfig()
    freezeNow(NOW)
    gcal.getEventsForMonth.mockResolvedValue([])
    gcal.createBookingEvent.mockResolvedValue({ id: 'gcal_evt_1' })
    sms.sendSms.mockResolvedValue({ sid: 'SM1', to: '+14505551234' })
    fetchMock().mockResolvedValue({ id: 'email' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { vi.useRealTimers() })

  describe('validation (400, nothing is booked)', () => {
    it.each([
      ['unknown service', validBody({ serviceId: 'group' }), /Service invalide/],
      ['missing service', validBody({ serviceId: undefined }), /Service invalide/],
      ['bad session type', validBody({ sessionType: 'phone' }), /Type de séance invalide/],
      ['missing start', validBody({ isoStart: '' }), /Créneau horaire invalide/],
      ['garbage date', validBody({ isoStart: 'demain' }), /Créneau horaire invalide/],
      ['end before start', validBody({ isoStart: SLOT.isoEnd, isoEnd: SLOT.isoStart }), /Créneau horaire invalide/],
      ['duration mismatch (couple = 90 min)', validBody({ serviceId: 'couple' }), /durée du créneau/],
      ['missing first name', validBody({}, { firstName: '  ' }), /incomplètes/],
      ['missing email', validBody({}, { email: '' }), /incomplètes/],
      ['client not an object', validBody({ client: 'Marie' }), /incomplètes/],
      ['invalid email', validBody({}, { email: 'marie@' }), /courriel invalide/],
      ['SMS consent without phone', validBody({}, { smsConsent: true }), /téléphone valide/],
      ['SMS consent with bad phone', validBody({}, { smsConsent: true, phone: '123' }), /téléphone valide/],
    ])('%s', async (_name, body, message) => {
      const res = await callHandler(await load(), { body })
      expect(res.status).toBe(400)
      expect(errorMessage(res)).toMatch(message)
      expect(gcal.createBookingEvent).not.toHaveBeenCalled()
      expect(fetchMock()).not.toHaveBeenCalled()
    })
  })

  it('rejects a slot that is no longer free with 409', async () => {
    gcal.getEventsForMonth.mockResolvedValue([
      { start: { dateTime: '2026-10-13T09:00:00-04:00' }, end: { dateTime: '2026-10-13T10:00:00-04:00' } },
    ])
    const res = await callHandler(await load(), { body: validBody() })
    expect(res.status).toBe(409)
    expect(errorMessage(res)).toMatch(/plus disponible/)
    expect(gcal.createBookingEvent).not.toHaveBeenCalled()
  })

  it('rejects a slot outside working hours (Friday) with 409', async () => {
    const res = await callHandler(await load(), {
      body: validBody({ isoStart: '2026-10-16T13:00:00.000Z', isoEnd: '2026-10-16T14:00:00.000Z' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects a slot inside the minimum notice window with 409', async () => {
    const res = await callHandler(await load(), {
      body: validBody({ isoStart: '2026-10-05T14:30:00.000Z', isoEnd: '2026-10-05T15:30:00.000Z' }),
    })
    expect(res.status).toBe(409)
  })

  it('returns 503 when the calendar cannot be read', async () => {
    gcal.getEventsForMonth.mockRejectedValue(new Error('invalid_grant'))
    const res = await callHandler(await load(), { body: validBody() })
    expect(res.status).toBe(503)
    expect(gcal.createBookingEvent).not.toHaveBeenCalled()
  })

  it('returns 503 and sends no email when the event cannot be created', async () => {
    gcal.createBookingEvent.mockRejectedValue(new Error('403 forbiddenForServiceAccounts'))
    const res = await callHandler(await load(), { body: validBody() })
    expect(res.status).toBe(503)
    expect(errorMessage(res)).toMatch(/Impossible de créer/)
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('books once, emails client + therapist, and skips SMS without consent', async () => {
    const res = await callHandler(await load(), { body: validBody({}, { message: 'Première fois' }) })
    expect(res.status).toBe(200)
    expect(res.json).toMatchObject({
      success: true,
      eventId: 'gcal_evt_1',
      meetLink: null,
      dateFormatted: 'mardi 13 octobre 2026',
      timeFormatted: '09h00 — 10h00',
    })
    expect(res.json.cancelToken).toMatch(/^[0-9a-f-]{36}$/)

    expect(gcal.getEventsForMonth).toHaveBeenCalledWith(2026, 10)
    expect(gcal.createBookingEvent).toHaveBeenCalledTimes(1)
    const ev = gcal.createBookingEvent.mock.calls[0]![0]
    expect(ev).toMatchObject({
      title: 'Séance — Marie Tremblay',
      startISO: SLOT.isoStart,
      endISO: SLOT.isoEnd,
      sessionType: 'in-person',
      colorId: '2',
      clientEmail: 'marie@example.com',
      clientName: 'Marie Tremblay',
      smsConsent: false,
      cancelToken: res.json.cancelToken,
    })
    expect(ev.description).toContain('Message: Première fois')

    const recipients = fetchMock().mock.calls.map(([, init]) => init.body.to)
    expect(recipients).toEqual(['marie@example.com', 'chantal@example.com'])
    expect(fetchMock().mock.calls.every(([url]) => url === 'https://api.resend.com/emails')).toBe(true)
    expect(sms.sendSms).not.toHaveBeenCalled()
  })

  it('sends the confirmation SMS with a cancel link when the client opted in', async () => {
    const res = await callHandler(await load(), {
      body: validBody({}, { smsConsent: true, phone: '(450) 555-1234' }),
    })
    expect(res.status).toBe(200)
    expect(gcal.createBookingEvent.mock.calls[0]![0]).toMatchObject({ clientPhone: '+14505551234', smsConsent: true })
    expect(sms.sendSms).toHaveBeenCalledTimes(1)
    const [to, text] = sms.sendSms.mock.calls[0]!
    expect(to).toBe('+14505551234')
    expect(text).toContain(`https://chantalmasse.com/annuler?token=${res.json.cancelToken}`)
    expect(text).toContain('09h00')
  })

  it('attaches the Meet room for video sessions', async () => {
    const res = await callHandler(await load(), { body: validBody({ sessionType: 'video' }) })
    expect(res.json.meetLink).toBe('https://meet.google.com/abc-defg-hij')
    expect(gcal.createBookingEvent.mock.calls[0]![0].meetLink).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('still confirms the booking when emails and SMS fail', async () => {
    fetchMock().mockRejectedValue(new Error('resend down'))
    sms.sendSms.mockRejectedValue(new Error('twilio down'))
    const res = await callHandler(await load(), {
      body: validBody({}, { smsConsent: true, phone: '4505551234' }),
    })
    expect(res.status).toBe(200)
    expect(res.json.success).toBe(true)
    expect(gcal.createBookingEvent).toHaveBeenCalledTimes(1)
  })

  it('never calls Meta CAPI when it is not configured', async () => {
    await callHandler(await load(), { body: validBody() })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
