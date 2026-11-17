import { afterEach, describe, expect, it, vi } from 'vitest'
import { google } from '~/server/shims/googleapis-calendar'

// The Worker build aliases googleapis to this shim; cancellation needs events.delete.
async function pemKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign'],
  )
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64')
  return `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----\n`
}

afterEach(() => { vi.unstubAllGlobals() })

describe('googleapis calendar shim', () => {
  it('deletes an event and accepts the empty 204 response', async () => {
    const calls: Array<{ url: string; method?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method })
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }))
      return new Response(null, { status: 204 })
    }))
    const auth = new google.auth.JWT({ email: 'sa@example.iam.gserviceaccount.com', key: await pemKey(), scopes: ['x'] })
    const cal = google.calendar({ version: 'v3', auth })
    await expect(cal.events.delete({ calendarId: 'cal@example.com', eventId: 'evt 1' })).resolves.toEqual({ data: undefined })
    expect(calls.at(-1)).toEqual({ url: 'https://www.googleapis.com/calendar/v3/calendars/cal%40example.com/events/evt%201', method: 'DELETE' })
  })
})
