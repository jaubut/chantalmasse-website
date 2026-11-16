import type { H3Event } from 'h3'

// Server-side calls to the dashboard's public newsletter API (tls-dashboard-v2 #433).
// The site key never reaches the browser. The dashboard also checks the Origin,
// so the browser's is forwarded, and only from the real site.
export const NEWSLETTER_ORIGINS = ['https://chantalmasse.com', 'https://www.chantalmasse.com']
const UNAVAILABLE = 'L’inscription à l’infolettre est temporairement indisponible.'

export function newsletterError(status: number): never {
  if (status === 429) throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessayez dans quelques minutes.' })
  throw createError({ statusCode: 503, statusMessage: UNAVAILABLE })
}

export async function callNewsletterApi(event: H3Event, path: 'subscribe' | 'confirm', body: Record<string, string>) {
  // Per request, so Cloudflare runtime bindings (NUXT_NEWSLETTER_*) apply.
  const { newsletterApiBase, newsletterSiteKey } = useRuntimeConfig(event)
  if (!newsletterApiBase || !newsletterSiteKey) newsletterError(503)

  const origin = getRequestHeader(event, 'origin') ?? ''
  if (!NEWSLETTER_ORIGINS.includes(origin)) throw createError({ statusCode: 403, statusMessage: 'Requête refusée.' })

  try {
    return await $fetch.raw<{ result?: unknown }>(`${String(newsletterApiBase).replace(/\/$/, '')}/api/public/newsletter/${path}`, {
      method: 'POST',
      body,
      headers: {
        'X-Site-Key': String(newsletterSiteKey),
        Origin: origin,
        // Cloudflare sets cf-connecting-ip; x-forwarded-for can carry a client-supplied first entry.
        'X-Subscriber-IP': getRequestHeader(event, 'cf-connecting-ip') ?? getRequestIP(event, { xForwardedFor: true }) ?? '',
      },
      timeout: 10_000,
      ignoreResponseError: true,
    })
  } catch {
    // Timeout or network failure: never surface the dashboard's address.
    newsletterError(503)
  }
}
