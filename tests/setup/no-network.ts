// Unit/server tests must never reach Brevo, Google, Resend, Twilio, Meta,
// Anthropic or Turso. Any un-mocked fetch fails loudly instead.
import { beforeEach, vi } from 'vitest'

const SECRET_ENV = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CALENDAR_ID',
  'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_TO',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER',
  'BREVO_API_KEY', 'BREVO_LIST_ID', 'BREVO_DOI_TEMPLATE_ID',
  'META_PIXEL_ID', 'META_CAPI_ACCESS_TOKEN', 'META_CAPI_TEST_EVENT_CODE',
  'ANTHROPIC_API_KEY', 'APIFY_API_TOKEN', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN',
]

for (const key of SECRET_ENV) delete process.env[key]

export const blockedFetch = (input: unknown) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String((input as Request)?.url ?? input)
  throw new Error(`network disabled in tests: ${url}`)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(blockedFetch))
})
