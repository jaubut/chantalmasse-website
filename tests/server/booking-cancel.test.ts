import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callHandler, errorMessage, fetchMock, loadHandler, setRuntimeConfig } from '../helpers/server'

const gcal = vi.hoisted(() => ({
  findEventByCancelToken: vi.fn(),
  cancelEventById: vi.fn(),
}))
const sms = vi.hoisted(() => ({ sendSms: vi.fn() }))

vi.mock('~/server/utils/googleCalendar', () => gcal)
vi.mock('~/server/utils/sms', async (importOriginal) => {
  const real = await importOriginal<typeof import('~/server/utils/sms')>()
  return { ...real, sendSms: sms.sendSms }
})

function bookedEvent(priv: Record<string, string> = {}) {
  return {
    id: 'gcal_evt_1',
    colorId: '7',
    start: { dateTime: '2026-10-14T13:00:00Z' },
    end: { dateTime: '2026-10-14T14:30:00Z' },
    extendedProperties: {
      private: { clientEmail: 'marie@example.com', clientName: 'Marie Tremblay', sessionType: 'in-person', ...priv },
    },
  }
}

beforeEach(() => {
  setRuntimeConfig()
  gcal.findEventByCancelToken.mockResolvedValue(bookedEvent())
  gcal.cancelEventById.mockResolvedValue(undefined)
  sms.sendSms.mockResolvedValue({ sid: 'SM1', to: '+14505551234' })
  fetchMock().mockResolvedValue({ id: 'email' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/booking/cancel-info', () => {
  const load = () => loadHandler('~/server/api/booking/cancel-info.get')

  it.each([[{}], [{ token: '   ' }]])('requires a token (%j)', async (query) => {
    const res = await callHandler(await load(), { query })
    expect(res.status).toBe(400)
    expect(gcal.findEventByCancelToken).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown, cancelled or past booking', async () => {
    gcal.findEventByCancelToken.mockResolvedValue(null)
    const res = await callHandler(await load(), { query: { token: 'nope' } })
    expect(res.status).toBe(404)
    expect(errorMessage(res)).toMatch(/plus valide/)
  })

  it('returns 503 when the calendar lookup fails', async () => {
    gcal.findEventByCancelToken.mockRejectedValue(new Error('boom'))
    const res = await callHandler(await load(), { query: { token: 'abc' } })
    expect(res.status).toBe(503)
  })

  it('describes the booking in French without leaking the email', async () => {
    const res = await callHandler(await load(), { query: { token: 'abc' } })
    expect(res.status).toBe(200)
    expect(gcal.findEventByCancelToken).toHaveBeenCalledWith('abc')
    expect(res.json).toEqual({
      firstName: 'Marie',
      service: 'Coaching de Couple',
      sessionType: 'in-person',
      date: 'mercredi 14 octobre 2026',
      time: '09h00 — 10h30',
      startISO: '2026-10-14T13:00:00Z',
    })
    expect(JSON.stringify(res.json)).not.toContain('marie@example.com')
  })
})

describe('POST /api/booking/cancel', () => {
  const load = () => loadHandler('~/server/api/booking/cancel.post')

  it.each([[{}], [{ token: '' }], [{ token: 42 }]])('requires a token (%j)', async (body) => {
    const res = await callHandler(await load(), { body })
    expect(res.status).toBe(400)
    expect(gcal.cancelEventById).not.toHaveBeenCalled()
  })

  it('returns 404 when the token matches nothing (single-use links)', async () => {
    gcal.findEventByCancelToken.mockResolvedValue(null)
    const res = await callHandler(await load(), { body: { token: 'used' } })
    expect(res.status).toBe(404)
    expect(gcal.cancelEventById).not.toHaveBeenCalled()
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('returns 503 when the lookup fails', async () => {
    gcal.findEventByCancelToken.mockRejectedValue(new Error('boom'))
    const res = await callHandler(await load(), { body: { token: 'abc' } })
    expect(res.status).toBe(503)
  })

  it('returns 503 and notifies nobody when the delete fails', async () => {
    gcal.cancelEventById.mockRejectedValue(new Error('boom'))
    const res = await callHandler(await load(), { body: { token: 'abc' } })
    expect(res.status).toBe(503)
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('deletes the event and notifies client + therapist', async () => {
    const res = await callHandler(await load(), { body: { token: ' abc ' } })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({
      success: true,
      message: 'Votre rendez-vous a été annulé.',
      date: 'mercredi 14 octobre 2026',
      time: '09h00 — 10h30',
    })
    expect(gcal.findEventByCancelToken).toHaveBeenCalledWith('abc')
    expect(gcal.cancelEventById).toHaveBeenCalledWith('gcal_evt_1')
    expect(fetchMock().mock.calls.map(([, init]) => init.body.to)).toEqual(['marie@example.com', 'chantal@example.com'])
    expect(sms.sendSms).not.toHaveBeenCalled()
  })

  it('texts the client only with SMS consent and a phone', async () => {
    gcal.findEventByCancelToken.mockResolvedValue(bookedEvent({ smsConsent: '1', clientPhone: '+14505551234' }))
    await callHandler(await load(), { body: { token: 'abc' } })
    expect(sms.sendSms).toHaveBeenCalledTimes(1)
    expect(sms.sendSms.mock.calls[0]![0]).toBe('+14505551234')
    expect(sms.sendSms.mock.calls[0]![1]).toContain('est annulée')
  })

  it('still cancels when every notification fails', async () => {
    gcal.findEventByCancelToken.mockResolvedValue(bookedEvent({ smsConsent: '1', clientPhone: '+14505551234' }))
    fetchMock().mockRejectedValue(new Error('resend down'))
    sms.sendSms.mockRejectedValue(new Error('twilio down'))
    const res = await callHandler(await load(), { body: { token: 'abc' } })
    expect(res.status).toBe(200)
    expect(gcal.cancelEventById).toHaveBeenCalledTimes(1)
  })
})
