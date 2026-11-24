// Response headers and the HTML cache for the routes rendered on the Worker.
// - X-Robots-Tag as the Nuxt Worker sent it (routeRules robots:false): /annuler here, the static /confirmer-inscription in
//   dist/client/_headers (astro.config.mjs), and @nuxtjs/robots' default directives on 404s.
// - Preview Worker (PREVIEW_NOINDEX=1): every other rendered response says noindex too.
// - Preview mode (`__tls_preview` cookie): verified with `PREVIEW_SECRET` (HS256 JWT `aud: "tls-preview"`, `site: "chantal-masse"`)
//   before setting `ctx.locals.previewToken` / `ctx.locals.previewMode = true` or bypassing the KV page cache. An unverified or
//   expired cookie never skips the page cache and is cleared (`Max-Age=0`) on the response.
// - The CMS-backed pages (/, /coaching-de-couple, /therapie-individuelle, /prendre-rendez-vous, /blog, /blog/<slug>,
//   /sitemap.xml) go through the KV page cache (src/lib/page-cache.ts): CMS edits publish within the 60s SWR window.
import { defineMiddleware } from 'astro:middleware'
import { cssFirst } from './lib/css-first.mjs'
import { pageCache, SKIP_CACHE, type Kv } from './lib/page-cache'
import {
  applyPreviewResponseHeaders,
  buildPreviewSetCookie,
  hasRawPreviewCookie,
  PREVIEW_COOKIE,
  readPreviewCookie,
  SITE_ID,
  verifyPreviewToken,
} from './lib/tls-edit-attrs'

export const CACHED = /^\/(blog(\/[a-z0-9-]+)?|coaching-de-couple|therapie-individuelle|prendre-rendez-vous|sitemap\.xml)?$/
const NUXT_404_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

export interface WorkerEnv {
  PAGE_CACHE?: Kv
  PREVIEW_NOINDEX?: string
  PREVIEW_SECRET?: string
  CF_VERSION?: { id: string }
}

export async function headersFor(
  upstream: Response,
  pathname: string,
  env: WorkerEnv,
  previewMode = false,
  clearBadPreviewCookie?: { isHttps: boolean },
): Promise<Response> {
  // Rendered HTML: JS after CSS (src/lib/css-first.mjs). Other bodies stream through (proxied CMS media has immutable headers).
  const html = upstream.headers.get('content-type')?.includes('text/html')
  const res = new Response(html ? cssFirst(await upstream.text()) : upstream.body, upstream)
  res.headers.delete(SKIP_CACHE)
  if (pathname === '/annuler') res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  else if (res.status === 404 && !pathname.startsWith('/api/')) res.headers.set('X-Robots-Tag', NUXT_404_ROBOTS)
  if (clearBadPreviewCookie) {
    res.headers.append('set-cookie', buildPreviewSetCookie(null, clearBadPreviewCookie.isHttps))
  }
  if (previewMode) {
    applyPreviewResponseHeaders(res.headers, true)
    return res
  }
  if (env.PREVIEW_NOINDEX === '1' && !res.headers.has('X-Robots-Tag')) res.headers.set('X-Robots-Tag', 'noindex')
  return res
}

export interface MiddlewareContext {
  isPrerendered?: boolean
  url: URL
  request: Request
  locals: App.Locals
}

export const onRequest = defineMiddleware(async (ctx: MiddlewareContext, next: () => Promise<Response>) => {
  if (ctx.isPrerendered) return next() // build time (Node): no Worker env
  const { pathname } = ctx.url
  if (pathname === '/_tls/preview') return next()

  const { env } = await import('cloudflare:workers')
  const e = env as unknown as WorkerEnv
  const cookieHeader = ctx.request.headers.get('cookie')
  const rawCookie = readPreviewCookie(cookieHeader)
  const hadPreviewCookie = hasRawPreviewCookie(cookieHeader)
  const secret = e.PREVIEW_SECRET || (typeof process !== 'undefined' ? process.env.PREVIEW_SECRET : undefined)

  // Only trust `__tls_preview` (and bypass PAGE_CACHE) when `PREVIEW_SECRET` is configured and the token
  // passes cryptographic HS256 JWT verification (`aud: "tls-preview"`, `site: "chantal-masse"`, `exp`).
  const verified = Boolean(rawCookie && secret && await verifyPreviewToken(rawCookie, secret, SITE_ID))

  const previewToken = verified ? rawCookie : null
  const previewMode = Boolean(previewToken)
  ctx.locals.previewToken = previewToken
  ctx.locals.previewMode = previewMode

  const isHttps = ctx.url.protocol === 'https:' || ctx.request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https'
  const clearCookie = hadPreviewCookie && !verified ? { isHttps } : undefined

  if (previewMode) {
    const res = await next()
    const activePreviewMode = Boolean(ctx.locals.previewMode)
    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie') ?? '']
    const alreadyCleared = setCookies.some(c => c.includes(`${PREVIEW_COOKIE}=;`) && c.includes('Max-Age=0'))
    const clearRejectedCookie = !activePreviewMode && !alreadyCleared ? { isHttps } : undefined
    return await headersFor(res, pathname, e, activePreviewMode, clearRejectedCookie)
  }

  const kv = e.PAGE_CACHE
  if (!kv || ctx.request.method !== 'GET' || !CACHED.test(pathname)) {
    return await headersFor(await next(), pathname, e, false, clearCookie)
  }

  // Query strings (gclid, utm_*) never change these pages: one copy per path, as the prerendered Nuxt pages were.
  // Keyed by Worker version: cached HTML points at this deploy's hashed /_astro assets, which the next deploy removes.
  const key = `html:${e.CF_VERSION?.id ?? 'dev'}:${pathname}`
  const waitUntil = (p: Promise<unknown>): void => {
    const guarded = p.catch(err => console.error('[page-cache]', err))
    ctx.locals.cfContext?.waitUntil(guarded)
  }
  return await headersFor(await pageCache.serve(kv, key, () => next(), waitUntil), pathname, e, false, clearCookie)
})
