import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callHandler, errorMessage, loadHandler, setRuntimeConfig } from '../helpers/server'

const brevo = vi.hoisted(() => ({
  createDoiContact: vi.fn(),
  ctorArgs: [] as unknown[],
}))

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: class {
    contacts = { createDoiContact: brevo.createDoiContact }
    constructor(opts: unknown) { brevo.ctorArgs.push(opts) }
  },
}))

const load = () => loadHandler('~/server/api/newsletter/subscribe.post')

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    setRuntimeConfig()
    brevo.ctorArgs.length = 0
    brevo.createDoiContact.mockResolvedValue({})
  })

  it.each(['', 'pas-un-courriel', 'a@b', 'a b@c.com'])('rejects invalid email %j with 400', async (email) => {
    const res = await callHandler(await load(), { body: { email } })
    expect(res.status).toBe(400)
    expect(errorMessage(res)).toBe('Adresse courriel invalide.')
    expect(brevo.createDoiContact).not.toHaveBeenCalled()
  })

  it.each([
    [{ brevoApiKey: '' }],
    [{ brevoListId: 'abc' }],
    [{ brevoDoiTemplateId: undefined }],
  ])('returns 503 when Brevo is not configured (%j)', async (cfg) => {
    setRuntimeConfig(cfg)
    const res = await callHandler(await load(), { body: { email: 'marie@example.com' } })
    expect(res.status).toBe(503)
    expect(brevo.createDoiContact).not.toHaveBeenCalled()
  })

  it('creates a double-opt-in contact with a normalized email', async () => {
    const res = await callHandler(await load(), { body: { email: '  Marie@Example.COM ' } })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ success: true })
    expect(brevo.ctorArgs).toEqual([{ apiKey: 'xkeysib-dummy' }])
    expect(brevo.createDoiContact).toHaveBeenCalledWith({
      email: 'marie@example.com',
      includeListIds: [7],
      templateId: 12,
      redirectionUrl: 'https://chantalmasse.com/inscription-confirmee',
    })
  })

  it('attaches the SMS attribute only when a phone is given', async () => {
    await callHandler(await load(), { body: { email: 'marie@example.com', phone: '450 555-1234' } })
    expect(brevo.createDoiContact.mock.calls[0]![0].attributes).toEqual({ SMS: '450 555-1234' })
  })

  it('propagates a Brevo failure as a server error', async () => {
    brevo.createDoiContact.mockRejectedValue(new Error('brevo 502'))
    const res = await callHandler(await load(), { body: { email: 'marie@example.com' } })
    expect(res.status).toBeGreaterThanOrEqual(500)
  })
})
