import { beforeEach, describe, expect, it } from 'vitest'
import { callHandler, errorMessage, fetchMock, loadHandler, setRuntimeConfig } from '../helpers/server'

const load = () => loadHandler('~/server/api/contact.post')

describe('POST /api/contact', () => {
  beforeEach(() => {
    setRuntimeConfig()
    fetchMock().mockResolvedValue({ id: 'email_1' })
  })

  it.each([
    [{}],
    [{ name: 'Marie', contact: 'marie@example.com' }],
    [{ name: '   ', contact: 'marie@example.com', message: 'Bonjour' }],
    [{ name: 'Marie', contact: 42, message: 'Bonjour' }],
  ])('rejects incomplete input %j with 400', async (body) => {
    const res = await callHandler(await load(), { body })
    expect(res.status).toBe(400)
    expect(errorMessage(res)).toBe('Tous les champs sont requis.')
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('silently accepts honeypot submissions without sending email', async () => {
    const res = await callHandler(await load(), {
      body: { name: 'Bot', contact: 'bot@spam.io', message: 'buy', website: 'http://spam.io' },
    })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ ok: true })
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('returns 503 when email is not configured', async () => {
    setRuntimeConfig({ resendApiKey: '' })
    const res = await callHandler(await load(), {
      body: { name: 'Marie', contact: 'marie@example.com', message: 'Bonjour' },
    })
    expect(res.status).toBe(503)
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('sends one escaped email to Chantal with reply-to on the happy path', async () => {
    const res = await callHandler(await load(), {
      body: {
        name: 'Marie <script>alert(1)</script>',
        contact: 'marie@example.com',
        message: 'Ligne 1\r\nLigne 2 & "guillemets"',
      },
    })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ ok: true })
    expect(fetchMock()).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock().mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer re_test_dummy')
    expect(init.body.to).toBe('chantal@example.com')
    expect(init.body.reply_to).toBe('marie@example.com')
    expect(init.body.html).not.toContain('<script>')
    expect(init.body.html).toContain('&lt;script&gt;')
    expect(init.body.html).toContain('Ligne 1\nLigne 2 &amp; &quot;guillemets&quot;')
    expect(init.body.subject).not.toMatch(/[\r\n]/)
  })

  it('omits reply-to when the contact is a phone number', async () => {
    await callHandler(await load(), { body: { name: 'Marie', contact: '450-555-1234', message: 'Rappelle-moi' } })
    expect(fetchMock().mock.calls[0]![1].body.reply_to).toBeUndefined()
  })

  it('truncates oversized fields', async () => {
    await callHandler(await load(), {
      body: { name: 'N'.repeat(500), contact: 'marie@example.com', message: 'M'.repeat(10_000) },
    })
    const html: string = fetchMock().mock.calls[0]![1].body.html
    expect(html).toContain('N'.repeat(120))
    expect(html).not.toContain('N'.repeat(121))
    expect(html).not.toContain('M'.repeat(4001))
  })

  it('surfaces a provider failure as a server error (UI shows the fallback email)', async () => {
    fetchMock().mockRejectedValue(new Error('resend down'))
    const res = await callHandler(await load(), { body: { name: 'Marie', contact: 'm@example.com', message: 'Salut' } })
    expect(res.status).toBeGreaterThanOrEqual(500)
  })
})
