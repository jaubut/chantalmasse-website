// Meta Conversions API (CAPI) helper.
//
// Server-side mirror of the client-side Pixel events. Survives ad blockers,
// Safari ITP, and iOS opt-outs that drop client-side fbq() calls. Each event
// is dedup'd against the matching Pixel call via a shared `event_id`.
//
// Setup:
// - META_PIXEL_ID — find at Events Manager → Data Sources → your pixel → ID
// - META_CAPI_ACCESS_TOKEN — Events Manager → Settings → Conversions API → Generate access token
//   (DIFFERENT from the Graph API token — needs `ads_management` + the pixel scope)
// - Optional: META_CAPI_TEST_EVENT_CODE — set during QA to route events to the
//   "Test Events" tab in Events Manager (don't ship this to prod)
//
// Reference: https://developers.facebook.com/docs/marketing-api/conversions-api

import { createHash } from 'node:crypto'

export interface MetaCapiUserData {
  email?: string
  phone?: string             // E.164 preferred ("+15145551234")
  firstName?: string
  lastName?: string
  city?: string
  province?: string          // 2-letter ("QC")
  countryCode?: string       // 2-letter ("ca")
  zip?: string
  ipAddress?: string         // captured from request — getRequestIP() or x-forwarded-for
  userAgent?: string         // captured from request headers
  fbp?: string               // _fbp cookie value (client-side first-party Pixel cookie)
  fbc?: string               // _fbc cookie value (click ID, set by Pixel on ad-click landings)
  externalId?: string        // any stable user ID — booking event id is a fine fallback
}

export interface MetaCapiEvent {
  eventName: string          // 'Schedule' | 'Lead' | 'Contact' | 'Purchase' | 'InitiateCheckout' | …
  eventId: string            // MUST match the client-side fbq event_id for dedup
  eventTime?: number         // unix seconds — defaults to now
  eventSourceUrl: string     // page URL the event happened on
  actionSource?: 'website' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other'
  value?: number             // e.g. session price in CAD
  currency?: string          // 'CAD'
  contentName?: string       // e.g. 'Coaching de couple'
  contentCategory?: string
  user: MetaCapiUserData
}

export interface MetaCapiResult {
  ok: boolean
  status?: number
  events_received?: number
  fbtrace_id?: string
  error?: string
}

const META_API_VERSION = 'v21.0'

// SHA-256 hex of the lowercased+trimmed value. Meta requires PII to be hashed
// (except externalId, fbp, fbc, ipAddress, userAgent — those go in plain).
function hashPii(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  const norm = value.trim().toLowerCase()
  if (!norm) return undefined
  return createHash('sha256').update(norm).digest('hex')
}

// Meta wants phone digits-only, no leading +.
function hashPhone(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  const digits = value.replace(/\D/g, '')
  if (!digits) return undefined
  return createHash('sha256').update(digits).digest('hex')
}

function buildUserDataPayload(user: MetaCapiUserData): Record<string, string | undefined> {
  return {
    em: hashPii(user.email),
    ph: hashPhone(user.phone),
    fn: hashPii(user.firstName),
    ln: hashPii(user.lastName),
    ct: hashPii(user.city),
    st: hashPii(user.province),
    country: hashPii(user.countryCode),
    zp: hashPii(user.zip),
    external_id: hashPii(user.externalId),
    client_ip_address: user.ipAddress,
    client_user_agent: user.userAgent,
    fbp: user.fbp,
    fbc: user.fbc,
  }
}

// Strip undefined values so the JSON body stays minimal. Meta accepts the
// keys-or-omit shape; sending `null`/empty triggers a validation warning.
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') {
      out[k as keyof T] = v as T[keyof T]
    }
  }
  return out
}

/**
 * Send one event to the Meta Conversions API. Fail-silent: returns
 * { ok: false, error } instead of throwing — the caller must not let a
 * tracking failure block the user-visible flow (booking, contact, etc.).
 */
export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<MetaCapiResult> {
  const pixelId = process.env.META_PIXEL_ID
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN

  if (!pixelId || !accessToken) {
    // Not configured — silently skip in dev / before the Meta setup is done.
    return { ok: false, error: 'META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set' }
  }

  const eventTime = event.eventTime ?? Math.floor(Date.now() / 1000)
  const userData = compact(buildUserDataPayload(event.user))

  const customData = compact({
    value: event.value,
    currency: event.currency ?? 'CAD',
    content_name: event.contentName,
    content_category: event.contentCategory,
  })

  const eventPayload = compact({
    event_name: event.eventName,
    event_time: eventTime,
    event_id: event.eventId,
    event_source_url: event.eventSourceUrl,
    action_source: event.actionSource ?? 'website',
    user_data: userData,
    custom_data: Object.keys(customData).length ? customData : undefined,
  })

  const body: Record<string, unknown> = {
    data: [eventPayload],
  }
  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as { events_received?: number; fbtrace_id?: string; error?: { message?: string } }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error?.message ?? `HTTP ${res.status}`,
        fbtrace_id: data.fbtrace_id,
      }
    }
    return {
      ok: true,
      status: res.status,
      events_received: data.events_received,
      fbtrace_id: data.fbtrace_id,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown fetch error' }
  }
}

// Cookie helpers — convenience for Nitro event handlers that already have
// the H3 event in scope. Keep them tiny so the call site reads cleanly.
export function readFbCookies(getCookie: (name: string) => string | undefined): { fbp?: string; fbc?: string } {
  return { fbp: getCookie('_fbp'), fbc: getCookie('_fbc') }
}
