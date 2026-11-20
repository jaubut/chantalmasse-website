// Runs the repo's server/api handlers (Nitro/h3 style) unchanged inside the Astro Worker.
// They use Nitro auto-imports (defineEventHandler, readBody, useRuntimeConfig, $fetch…): this module installs them as
// globals before any handler module is evaluated (import it first), the same way tests/setup/nitro-globals.ts does.
// Error bodies keep Nitro's production JSON shape, which the booking/contact/newsletter UIs parse.
import { env } from 'cloudflare:workers'
import * as h3 from 'h3'
import { ofetch } from 'ofetch'

type Env = Record<string, unknown>
const vars = env as unknown as Env

// nuxt.config.ts runtimeConfig, resolved the way Nuxt does at runtime: NUXT_<KEY> wins, then the plain build-time name, then the default.
const PRIVATE: Record<string, [string, string?]> = {
  googleServiceAccountEmail: ['GOOGLE_SERVICE_ACCOUNT_EMAIL'],
  googlePrivateKey: ['GOOGLE_PRIVATE_KEY'],
  googleCalendarId: ['GOOGLE_CALENDAR_ID'],
  resendApiKey: ['RESEND_API_KEY'],
  emailFrom: ['EMAIL_FROM'],
  emailTo: ['EMAIL_TO'],
  chantalMeetLink: ['CHANTAL_MEET_LINK'],
  bookingMinNoticeHours: ['BOOKING_MIN_NOTICE_HOURS', '24'],
  twilioAccountSid: ['TWILIO_ACCOUNT_SID'],
  twilioAuthToken: ['TWILIO_AUTH_TOKEN'],
  twilioFromNumber: ['TWILIO_FROM_NUMBER'],
  siteBaseUrl: ['SITE_BASE_URL', 'https://chantalmasse.com'],
  newsletterApiBase: ['NEWSLETTER_API_BASE', 'https://dashboard.apies.dev'],
  newsletterSiteKey: ['NEWSLETTER_SITE_KEY', ''],
}
const PUBLIC: Record<string, [string, string]> = {
  bookingTimezone: ['BOOKING_TIMEZONE', 'America/Toronto'],
  bookingAdvanceDays: ['BOOKING_ADVANCE_DAYS', '60'],
  posthogKey: ['POSTHOG_KEY', ''],
  posthogHost: ['POSTHOG_HOST', 'https://us.i.posthog.com'],
}
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export function runtimeConfig(): Record<string, unknown> & { public: Record<string, string> } {
  const out: Record<string, unknown> & { public: Record<string, string> } = { public: {} }
  for (const [key, [name, dflt]] of Object.entries(PRIVATE)) out[key] = str(vars[`NUXT_${name}`]) ?? str(vars[name]) ?? dflt
  for (const [key, [name, dflt]] of Object.entries(PUBLIC)) out.public[key] = str(vars[`NUXT_PUBLIC_${name}`]) ?? str(vars[name]) ?? dflt
  return out
}

const g = globalThis as Record<string, unknown>
for (const name of ['defineEventHandler', 'readBody', 'getQuery', 'createError', 'getCookie', 'getRequestIP', 'getRequestHeader', 'setHeader', 'send'] as const)
  g[name] = h3[name]
g.useRuntimeConfig = runtimeConfig
g.$fetch = ofetch
// server/utils/bookingCache.ts reads the KV binding where Nitro's cloudflare_module preset puts the env.
g.__env__ = vars

/** Nitro's production error body (pretty JSON, statusMessage defaults to "Server Error"). */
export function nitroError(error: unknown, url: string): Response {
  const e = h3.createError(error as Error)
  const body: Record<string, unknown> = {
    error: true,
    url,
    statusCode: e.statusCode,
    statusMessage: e.statusMessage || 'Server Error',
    message: e.message,
  }
  if (e.data !== undefined) body.data = e.data
  if (e.statusCode >= 500 && !e.statusMessage) console.error('[api]', error)
  return new Response(JSON.stringify(body, null, 2), {
    status: e.statusCode,
    headers: { 'content-type': 'application/json' },
  })
}
