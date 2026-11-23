// /_tls/preview: preview handshake and cookie management for Stage 4b (S4b) of the tls-cms on-site editor.
// - GET /_tls/preview?token=<previewToken>&path=<relativePath>[&tls_edit=<editToken>]
//   Validates `token` (non-empty, <= 2048 chars) and `path` (/^\/(?!\/)[^\s\\]*$/, default `/`; rejects `//` or external URLs with 400).
//   Sets `__tls_preview=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600` (+ `Secure` on https:) and 303-redirects to `<path>`
//   preserving `?tls_edit=<editToken>` when present (`Cache-Control: no-store`, `Referrer-Policy: no-referrer`).
// - POST /_tls/preview
//   Accepts JSON `{ token?: string, clear?: boolean }` from same-origin fetch so `<tls-edit-bar>` can refresh or clear `__tls_preview`.
import type { APIRoute } from 'astro'
import {
  buildPreviewSetCookie,
  isValidPreviewToken,
  SAFE_PREVIEW_PATH_RE,
  validatePreviewPath,
} from '../../lib/tls-edit-attrs'

export const prerender = false

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
} as const

function isHttpsRequest(request: Request, url: URL): boolean {
  return url.protocol === 'https:' || request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https'
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
    return jsonResponse(
      { ok: true, preview: true },
      200,
      { 'set-cookie': buildPreviewSetCookie(body.token, isHttps) },
    )
  }

  return jsonResponse({ error: 'invalid_preview_request' }, 400)
}
