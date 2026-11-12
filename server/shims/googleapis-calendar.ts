import { normalizeGooglePrivateKey } from "../utils/googlePrivateKey"

function base64url(bytes: Uint8Array | string): string {
  const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes)
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = normalizeGooglePrivateKey(pem)
  const b64 = normalized
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "")
  const buf = Buffer.from(b64, "base64")
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

export class JWT {
  email: string
  key: string
  scopes: string[]
  private cachedToken: { token: string; exp: number } | null = null

  constructor(opts: { email: string; key: string; scopes: string[] }) {
    this.email = opts.email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ""
    this.key = opts.key || process.env.GOOGLE_PRIVATE_KEY || ""
    this.scopes = opts.scopes
  }

  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (this.cachedToken && this.cachedToken.exp - 60 > now) {
      return this.cachedToken.token
    }
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const payload = base64url(
      JSON.stringify({
        iss: this.email,
        scope: this.scopes.join(" "),
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    )
    const signingInput = `${header}.${payload}`
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(this.key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const sigBuf = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signingInput)
    )
    const signature = base64url(new Uint8Array(sigBuf))
    const assertion = `${signingInput}.${signature}`

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google OAuth token error (${res.status}): ${text}`)
    }
    const data = (await res.json()) as { access_token: string; expires_in: number }
    this.cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) }
    return data.access_token
  }
}

export function calendar(opts: { version: string; auth: JWT }) {
  const auth = opts.auth
  async function request(path: string, init: RequestInit = {}) {
    const token = await auth.getAccessToken()
    const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google Calendar API error (${res.status}): ${text}`)
    }
    const data = await res.json()
    return { data }
  }

  return {
    events: {
      async list(params: Record<string, any>) {
        const calendarId = params.calendarId || process.env.GOOGLE_CALENDAR_ID || ""
        const { calendarId: _cid, ...rest } = params
        const qs = new URLSearchParams()
        for (const [k, v] of Object.entries(rest)) {
          if (v === undefined || v === null) continue
          if (Array.isArray(v)) {
            for (const item of v) qs.append(k, String(item))
          } else {
            qs.set(k, String(v))
          }
        }
        return request(`/calendars/${encodeURIComponent(calendarId)}/events?${qs.toString()}`)
      },
      async insert(params: { calendarId: string; requestBody: any }) {
        const calendarId = params.calendarId || process.env.GOOGLE_CALENDAR_ID || ""
        return request(`/calendars/${encodeURIComponent(calendarId)}/events`, {
          method: "POST",
          body: JSON.stringify(params.requestBody),
        })
      },
      async patch(params: { calendarId: string; eventId: string; requestBody: any }) {
        const calendarId = params.calendarId || process.env.GOOGLE_CALENDAR_ID || ""
        return request(
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(params.eventId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(params.requestBody),
          }
        )
      },
    },
  }
}

export const auth = { JWT }
export const calendar_v3 = {}
export const google = { auth, calendar, calendar_v3 }
export default { google, auth, calendar, calendar_v3 }
