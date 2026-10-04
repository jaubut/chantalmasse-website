import { describe, expect, it, vi } from 'vitest'
import { cleanMultilineText, cleanText, escapeAttribute, escapeHtml, isEmail, stripHeaderValue } from '~/server/utils/input'
import { normalizeGooglePrivateKey } from '~/server/utils/googlePrivateKey'
import {
  clientCancellationEmail, clientConfirmationEmail, clientReminderEmail,
  therapistCancellationEmail, therapistNotificationEmail,
} from '~/server/utils/emailTemplates'

describe('input sanitizers', () => {
  it('cleanText trims, collapses whitespace, truncates and rejects non-strings', () => {
    expect(cleanText('  Marie \n\t Tremblay  ', 100)).toBe('Marie Tremblay')
    expect(cleanText('abcdef', 3)).toBe('abc')
    expect(cleanText(42, 10)).toBe('')
    expect(cleanText(null, 10)).toBe('')
    expect(cleanText({ toString: () => 'x' }, 10)).toBe('')
  })

  it('cleanMultilineText keeps newlines but normalizes CRLF', () => {
    expect(cleanMultilineText(' a\r\nb\rc ', 100)).toBe('a\nb\nc')
    expect(cleanMultilineText(['x'], 100)).toBe('')
  })

  it.each([
    ['marie@example.com', true],
    ['marie.tremblay+rdv@sous.domaine.qc.ca', true],
    ['marie@', false],
    ['@example.com', false],
    ['marie example@x.com', false],
    ['marie@example', false],
  ])('isEmail(%s) = %s', (value, ok) => {
    expect(isEmail(value)).toBe(ok)
  })

  it('escapeHtml/escapeAttribute neutralize markup', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeAttribute('a`b')).toBe('a&#96;b')
  })

  it('stripHeaderValue prevents header injection', () => {
    expect(stripHeaderValue('Sujet\r\nBcc: evil@x.com', 200)).not.toMatch(/[\r\n]/)
  })
})

describe('normalizeGooglePrivateKey', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n'
  it.each([
    ['raw multiline', pem],
    ['escaped \\n', pem.replace(/\n/g, '\\n')],
    ['double-escaped \\\\n', pem.replace(/\n/g, '\\\\n')],
    ['double-quoted', `"${pem.replace(/\n/g, '\\n')}"`],
    ['single-quoted', `'${pem.replace(/\n/g, '\\n')}'`],
    ['missing trailing newline', pem.trimEnd()],
  ])('accepts %s', (_name, input) => {
    expect(normalizeGooglePrivateKey(input)).toBe(pem)
  })

  it('handles an unset key', () => {
    expect(normalizeGooglePrivateKey(undefined)).toBe('\n')
  })
})

describe('email templates', () => {
  const xss = '<script>alert(1)</script>'

  it('client confirmation escapes user data and links the cancel page', () => {
    const { subject, html } = clientConfirmationEmail({
      firstName: xss, service: 'Thérapie Individuelle', date: 'mardi 13 octobre 2026', time: '09h00 — 10h00',
      sessionType: 'video', meetLink: 'https://meet.google.com/abc-defg-hij', cancelToken: 'a b&c',
    })
    expect(subject).toContain('Chantal Massé')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('https://meet.google.com/abc-defg-hij')
    expect(html).toContain('annuler?token=a%20b%26c')
  })

  it('in-person confirmation shows Shefford and no Meet button', () => {
    const { html } = clientConfirmationEmail({
      firstName: 'Marie', service: 'Coaching de Couple', date: 'd', time: 't', sessionType: 'in-person', cancelToken: 'tok',
    })
    expect(html).toContain('Shefford')
    expect(html).not.toContain('meet.google.com')
  })

  it('therapist notification escapes the free-text message and keeps line breaks', () => {
    const { subject, html } = therapistNotificationEmail({
      clientName: 'Marie\r\nBcc: x@y.z', clientEmail: 'marie@example.com', service: 'Thérapie Individuelle',
      date: 'd', time: 't', sessionType: 'in-person', message: `${xss}\nligne 2`,
    })
    expect(subject).not.toMatch(/[\r\n]/)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br>ligne 2')
  })

  it('cancellation and reminder templates render with escaped names', () => {
    const params = { firstName: xss, service: 'S', date: 'd', time: 't' }
    expect(clientCancellationEmail(params).html).not.toContain('<script>')
    expect(therapistCancellationEmail({ clientName: xss, clientEmail: 'm@e.com', service: 'S', date: 'd', time: 't' }).html).not.toContain('<script>')
    const reminder = clientReminderEmail({ ...params, sessionType: 'in-person', cancelToken: 'tok' })
    expect(reminder.html).not.toContain('<script>')
    expect(reminder.html).toContain('annuler?token=tok')
  })
})

describe('sms', async () => {
  const create = vi.fn()
  vi.doMock('twilio', () => ({ default: () => ({ messages: { create } }) }))
  const sms = await import('~/server/utils/sms')

  it.each([
    ['450 555-1234', '+14505551234'],
    ['(450) 555-1234', '+14505551234'],
    ['1-450-555-1234', '+14505551234'],
    ['+1 450 555 1234', '+14505551234'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['555-1234', null],
    ['+123', null],
    ['', null],
    [null, null],
  ])('normalizePhone(%j) = %j', (input, expected) => {
    expect(sms.normalizePhone(input)).toBe(expected)
  })

  it('sendSms normalizes the number and uses the configured sender', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACdummy')
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'dummy')
    vi.stubEnv('TWILIO_FROM_NUMBER', '+15005550006')
    create.mockResolvedValue({ sid: 'SM1' })
    await expect(sms.sendSms('450 555-1234', 'Salut')).resolves.toEqual({ sid: 'SM1', to: '+14505551234' })
    expect(create).toHaveBeenCalledWith({ from: '+15005550006', to: '+14505551234', body: 'Salut' })
    await expect(sms.sendSms('123', 'x')).rejects.toThrow(/invalid phone/)
    vi.unstubAllEnvs()
  })

  it('sendSms fails clearly without a sender number', async () => {
    await expect(sms.sendSms('4505551234', 'x')).rejects.toThrow(/TWILIO_FROM_NUMBER/)
  })

  it('SMS bodies use tu, carry the cancel link and stay short', () => {
    const ctx = { firstName: 'Marie', dateFormatted: 'mardi 13 octobre 2026', startTime: '09h00', sessionType: 'in-person' as const, cancelUrl: 'https://chantalmasse.com/annuler?token=tok' }
    const confirm = sms.bookingConfirmationSms(ctx)
    expect(confirm).toContain('ta séance')
    expect(confirm).toContain(ctx.cancelUrl)
    expect(sms.bookingReminderSms({ ...ctx, sessionType: 'video' })).toContain('Lien visio')
    expect(sms.bookingCancellationSms(ctx)).toContain('/prendre-rendez-vous')
  })
})
