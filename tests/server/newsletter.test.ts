import { readFileSync } from 'node:fs'
import { $fetch as realFetch } from 'ofetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callHandler, errorMessage, loadHandler, setRuntimeConfig } from '../helpers/server'
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from '~/utils/newsletterConsent'

// The dashboard (tls-dashboard-v2 #433) is faked at the HTTP boundary: the real
// ofetch client runs, and global fetch answers as the dashboard would.
const SITE = { origin: 'https://chantalmasse.com', 'x-forwarded-for': '203.0.113.7' }
const dashboard = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

function sent() {
  expect(dashboard).toHaveBeenCalledTimes(1)
  const [url, init] = dashboard.mock.calls[0]!
  return { url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) }
}

beforeEach(() => {
  setRuntimeConfig()
  dashboard.mockReset()
  vi.stubGlobal('fetch', (input: Request | string, init: RequestInit = {}) =>
    dashboard(typeof input === 'string' ? input : input.url, input instanceof Request ? { ...init, headers: input.headers, body: init.body } : init))
  ;(globalThis as Record<string, unknown>).$fetch = realFetch
})

describe('POST /api/newsletter/subscribe', () => {
  const load = () => loadHandler('~/server/api/newsletter/subscribe.post')

  it.each(['', 'pas-un-courriel', 'a@b', 'a b@c.com'])('rejects invalid email %j with 400 before calling the dashboard', async (email) => {
    const res = await callHandler(await load(), { body: { email }, headers: SITE })
    expect(res.status).toBe(400)
    expect(errorMessage(res)).toBe('Adresse courriel invalide.')
    expect(dashboard).not.toHaveBeenCalled()
  })

  it('forwards key, Origin, subscriber IP and the pinned consent version', async () => {
    dashboard.mockReturnValue(json(202, { ok: true }))
    const res = await callHandler(await load(), { body: { email: '  Marie@Example.COM ', website: '', phone: '450' }, headers: SITE })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ success: true })
    const call = sent()
    expect(call.url).toBe('https://dashboard.test/api/public/newsletter/subscribe')
    expect(call.headers.get('x-site-key')).toBe('site-key-dummy-0123456789abcdef0123')
    expect(call.headers.get('origin')).toBe('https://chantalmasse.com')
    expect(call.headers.get('x-subscriber-ip')).toBe('203.0.113.7')
    expect(call.body).toEqual({ email: 'marie@example.com', consent_version: '2026-11-v1', website: '' })
  })

  it('takes the subscriber IP from cf-connecting-ip over x-forwarded-for (Cloudflare)', async () => {
    dashboard.mockReturnValue(json(202, { ok: true }))
    await callHandler(await load(), {
      body: { email: 'marie@example.com' },
      headers: { ...SITE, 'x-forwarded-for': '6.6.6.6, 198.51.100.9', 'cf-connecting-ip': '198.51.100.9' },
    })
    expect(sent().headers.get('x-subscriber-ip')).toBe('198.51.100.9')
  })

  it('passes a filled honeypot through (the dashboard answers a decoy 202)', async () => {
    dashboard.mockReturnValue(json(202, { ok: true }))
    const res = await callHandler(await load(), { body: { email: 'bot@example.com', website: 'http://spam' }, headers: SITE })
    expect(res.json).toEqual({ success: true })
    expect(sent().body.website).toBe('http://spam')
  })

  it.each([undefined, 'https://evil.example', 'https://chantalmasse-website.workers.dev'])('refuses Origin %j without calling the dashboard', async (origin) => {
    const res = await callHandler(await load(), { body: { email: 'marie@example.com' }, headers: origin ? { origin } : {} })
    expect(res.status).toBe(403)
    expect(dashboard).not.toHaveBeenCalled()
  })

  it.each([[{ newsletterSiteKey: '' }], [{ newsletterApiBase: '' }]])('returns 503 when unconfigured (%j)', async (cfg) => {
    setRuntimeConfig(cfg)
    const res = await callHandler(await load(), { body: { email: 'marie@example.com' }, headers: SITE })
    expect(res.status).toBe(503)
    expect(dashboard).not.toHaveBeenCalled()
  })

  it.each([
    [400, { error: 'invalid_email' }, 400, 'Adresse courriel invalide.'],
    [429, { error: 'rate_limited' }, 429, 'Trop de tentatives, réessayez dans quelques minutes.'],
    [403, { error: 'forbidden' }, 503, 'L’inscription à l’infolettre est temporairement indisponible.'],
    [503, { error: 'unavailable' }, 503, 'L’inscription à l’infolettre est temporairement indisponible.'],
    [404, {}, 503, 'L’inscription à l’infolettre est temporairement indisponible.'],
  ])('maps dashboard %i to %i', async (upstream, body, status, message) => {
    dashboard.mockReturnValue(json(upstream, body))
    const res = await callHandler(await load(), { body: { email: 'marie@example.com' }, headers: SITE })
    expect(res.status).toBe(status)
    expect(errorMessage(res)).toBe(message)
    expect(JSON.stringify(res.json)).not.toContain('dashboard.test')
  })

  it('maps a network failure or timeout to 503', async () => {
    dashboard.mockRejectedValue(new DOMException('The operation was aborted.', 'TimeoutError'))
    const res = await callHandler(await load(), { body: { email: 'marie@example.com' }, headers: SITE })
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.json)).not.toContain('dashboard.test')
  })
})

describe('POST /api/newsletter/confirm', () => {
  const load = () => loadHandler('~/server/api/newsletter/confirm.post')

  it.each(['confirmed', 'opted_out', 'invalid'])('passes result %s through and forwards the token', async (result) => {
    dashboard.mockReturnValue(json(200, { result }))
    const res = await callHandler(await load(), { body: { token: 'abc.def' }, headers: SITE })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ result })
    const call = sent()
    expect(call.url).toBe('https://dashboard.test/api/public/newsletter/confirm')
    expect(call.headers.get('x-site-key')).toBe('site-key-dummy-0123456789abcdef0123')
    expect(call.headers.get('origin')).toBe('https://chantalmasse.com')
    expect(call.headers.get('x-subscriber-ip')).toBe('203.0.113.7')
    expect(call.body).toEqual({ token: 'abc.def' })
  })

  it.each([undefined, '', 42, 'x'.repeat(1025)])('answers invalid for token %j without calling the dashboard', async (token) => {
    const res = await callHandler(await load(), { body: { token }, headers: SITE })
    expect(res.json).toEqual({ result: 'invalid' })
    expect(dashboard).not.toHaveBeenCalled()
  })

  it('refuses a foreign Origin', async () => {
    const res = await callHandler(await load(), { body: { token: 'abc.def' }, headers: { origin: 'https://evil.example' } })
    expect(res.status).toBe(403)
    expect(dashboard).not.toHaveBeenCalled()
  })

  it.each([
    [429, { error: 'rate_limited' }, 429],
    [403, { error: 'forbidden' }, 503],
    [200, { result: 'something-else' }, 503],
  ])('maps dashboard %i %j to %i', async (upstream, body, status) => {
    dashboard.mockReturnValue(json(upstream, body))
    const res = await callHandler(await load(), { body: { token: 'abc.def' }, headers: SITE })
    expect(res.status).toBe(status)
  })

  it('maps a timeout to 503', async () => {
    dashboard.mockRejectedValue(new DOMException('The operation was aborted.', 'TimeoutError'))
    const res = await callHandler(await load(), { body: { token: 'abc.def' }, headers: SITE })
    expect(res.status).toBe(503)
  })
})

describe('newsletter consent and Brevo removal', () => {
  it('pins the wording v2026-11-v1 exactly as tls-dashboard-v2 stores it', () => {
    expect(NEWSLETTER_CONSENT_VERSION).toBe('2026-11-v1')
    expect(NEWSLETTER_CONSENT_TEXT).toBe(
      "En m'abonnant, j'accepte de recevoir l'infolettre mensuelle de Chantal Massé, thérapeute en relation d'aide (pistes de réflexion et ressources). Je peux me désabonner en tout temps par le lien inclus dans chaque courriel. Chantal Massé, chantal.gmasse@gmail.com.",
    )
  })

  it('no longer depends on Brevo', () => {
    for (const file of ['package.json', 'nuxt.config.ts', 'server/api/newsletter/subscribe.post.ts']) {
      expect(readFileSync(file, 'utf8').toLowerCase()).not.toContain('brevo')
    }
  })
})
