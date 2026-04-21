// Twilio SMS helper used by the booking API (confirmation) and the
// Trigger.dev reminder task (24h-before).
//
// Reads credentials from process.env directly so it works in both the Nuxt
// server runtime and the standalone Trigger.dev worker — neither of which
// share config. Required vars:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER   (E.164, e.g. "+14505551234")
//
// Phone normalization assumes Canadian numbers by default: if a 10-digit
// local number is passed, +1 is prepended. Anything starting with + is
// taken as already-E.164 and only stripped of whitespace/formatting.

import twilio from 'twilio'

const CANADA_PREFIX = '+1'

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Already E.164-ish: starts with +, keep digits only after the plus.
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 15) return null
    return `+${digits}`
  }

  // Bare digits only: expect 10 (Canadian/US local) or 11 with leading 1.
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `${CANADA_PREFIX}${digits}`
  return null
}

let cachedClient: ReturnType<typeof twilio> | null = null

function getTwilioClient() {
  if (cachedClient) return cachedClient
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required')
  }
  cachedClient = twilio(sid, token)
  return cachedClient
}

export interface SendSmsResult {
  sid: string
  to: string
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const from = process.env.TWILIO_FROM_NUMBER
  if (!from) throw new Error('TWILIO_FROM_NUMBER required')

  const normalized = normalizePhone(to)
  if (!normalized) throw new Error(`invalid phone: ${to}`)

  const client = getTwilioClient()
  const msg = await client.messages.create({ from, to: normalized, body })
  return { sid: msg.sid, to: normalized }
}

// Short SMS bodies kept under 160 chars when possible so they ship as a
// single segment. Uses `tu` to match the rest of the site voice.

interface SmsContext {
  firstName: string
  dateFormatted: string
  startTime: string
  sessionType: 'in-person' | 'video'
  cancelUrl: string
}

export function bookingConfirmationSms(ctx: SmsContext): string {
  const where = ctx.sessionType === 'video'
    ? 'Lien visio dans ton courriel.'
    : 'Shefford, QC.'
  return `Salut ${ctx.firstName}, ta séance avec Chantal est confirmée le ${ctx.dateFormatted} à ${ctx.startTime}. ${where} Annuler: ${ctx.cancelUrl}`
}

export function bookingReminderSms(ctx: SmsContext): string {
  const where = ctx.sessionType === 'video'
    ? 'Lien visio dans ton courriel.'
    : 'Shefford, QC.'
  return `Rappel: ta séance avec Chantal, c'est demain à ${ctx.startTime}. ${where} Annuler: ${ctx.cancelUrl}`
}
