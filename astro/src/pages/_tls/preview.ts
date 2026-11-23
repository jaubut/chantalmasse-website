// /_tls/preview: preview handshake and cookie management for Stage 4b (S4b) of the tls-cms on-site editor.
// - GET /_tls/preview?token=<previewToken>&path=<relativePath>[&tls_edit=<editToken>]
//   Validates `token` (non-empty, <= 2048 chars; cryptographically verified as an HS256 JWT with `aud: "tls-preview"`
//   and `site: "chantal-masse"` when `PREVIEW_SECRET` is configured) and `path` (/^\/(?!\/)[^\s\\]*$/, default `/`;
//   rejects `//` or external URLs with 400).
//   Sets `__tls_preview=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600` (+ `Secure` on https:) and 303-redirects
//   to `<path>` preserving `?tls_edit=<editToken>` when present (`Cache-Control: no-store`, `Referrer-Policy: no-referrer`).
// - POST /_tls/preview
//   Accepts JSON `{ token?: string, clear?: boolean }` from same-origin fetch so `<tls-edit-bar>` can refresh or clear `__tls_preview`.
//
// Threat model note:
// - The 1-click portal launch redirects the editor's browser here with a short-lived (1 h), site-bound (`site: "chantal-masse"`,
//   `aud: "tls-preview"`) HS256 preview token signed by `tls-cms` (`cms/worker/src/auth.ts` `signPreview`) plus a single-use
//   10-min `tls_edit` token.
// - Both this handshake route and `src/middleware.ts` verify the HS256 signature against `PREVIEW_SECRET` before trusting the
//   cookie, and `tls-cms` `SiteReads` (`cms/worker/src/index.ts` `readHandler` -> `hasPreview`) independently re-verifies
//   `Authorization: Preview <token>` against `PREVIEW_SECRET` on the service binding before serving any `stage=draft` read.
// - `Referrer-Policy: no-referrer` and immediate `history.replaceState` stripping of `?tls_edit` in `Base.astro` prevent token
//   leakage via Referer headers or third-party analytics.
import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import {
  buildPreviewSetCookie,
  isValidPreviewToken,
  SAFE_PREVIEW_PATH_RE,
  SITE_ID,
  validatePreviewPath,
  verifyPreviewToken,
} from '../../lib/tls-edit-attrs'

export const prerender = false

interface PreviewEnv {
  PREVIEW_SECRET?: string
}

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
} as const

function isHttpsRequest(request: Request, url: URL): boolean {
  return url.protocol === 'https:' || request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https'
}

function getPreviewSecret(): string | undefined {
  const workerSecret = (env as unknown as PreviewEnv | undefined)?.PREVIEW_SECRET
  return workerSecret || (typeof process !== 'undefined' ? process.env.PREVIEW_SECRET : undefined)
}

function jsonResponse(body: Record<string, unknown>, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...NO_STORE_HEADERS,
      ...extraHeaders,
    },
  })
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!isValidPreviewToken(token)) {
    return jsonResponse({ error: 'invalid_token' }, 400)
  }

  const secret = getPreviewSecret()
  if (!(await verifyPreviewToken(token, secret, SITE_ID))) {
    return jsonResponse({ error: 'invalid_token' }, secret ? 401 : 400)
  }

  const rawPath = url.searchParams.get('path')
  const validPath = validatePreviewPath(rawPath)
  if (!validPath) {
    return jsonResponse({ error: 'invalid_path' }, 400)
  }

  const hasEditParam = url.searchParams.has('tls_edit')
  const editToken = url.searchParams.get('tls_edit')
  if (hasEditParam && !isValidPreviewToken(editToken)) {
    return jsonResponse({ error: 'invalid_edit_token' }, 400)
  }

  const target = new URL(validPath, 'https://chantalmasse.local')
  if (target.origin !== 'https://chantalmasse.local' || !SAFE_PREVIEW_PATH_RE.test(target.pathname)) {
    return jsonResponse({ error: 'invalid_path' }, 400)
  }
  if (editToken) {
    target.searchParams.set('tls_edit', editToken)
  }
  const location = `${target.pathname}${target.search}${target.hash}`
  if (!SAFE_PREVIEW_PATH_RE.test(location)) {
    return jsonResponse({ error: 'invalid_path' }, 400)
  }

  const isHttps = isHttpsRequest(request, url)
  return new Response(null, {
    status: 303,
    headers: {
      location,
      'set-cookie': buildPreviewSetCookie(token, isHttps),
      ...NO_STORE_HEADERS,
    },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  if (origin && origin !== url.origin) {
    return jsonResponse({ error: 'origin_mismatch' }, 403)
  }
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return jsonResponse({ error: 'forbidden_fetch_site' }, 403)
  }

  const body = (await request.json().catch(() => null)) as { token?: unknown, clear?: unknown } | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }

  const isHttps = isHttpsRequest(request, url)
  if (body.clear === true) {
    return jsonResponse(
      { ok: true, preview: false },
      200,
      { 'set-cookie': buildPreviewSetCookie(null, isHttps) },
    )
  }

  if (isValidPreviewToken(body.token)) {
    const secret = getPreviewSecret()
    if (!(await verifyPreviewToken(body.token, secret, SITE_ID))) {
      return jsonResponse({ error: 'invalid_token' }, secret ? 401 : 400)
    }
    return jsonResponse(
      { ok: true, preview: true },
      200,
      { 'set-cookie': buildPreviewSetCookie(body.token, isHttps) },
    )
  }

  return jsonResponse({ error: 'invalid_preview_request' }, 400)
}
