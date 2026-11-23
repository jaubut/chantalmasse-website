// Response headers and the HTML cache for the routes rendered on the Worker.
// - X-Robots-Tag as the Nuxt Worker sent it (routeRules robots:false): /annuler here, the static /confirmer-inscription in
//   dist/client/_headers (astro.config.mjs), and @nuxtjs/robots' default directives on 404s.
// - Preview Worker (PREVIEW_NOINDEX=1): every other rendered response says noindex too.
// - Preview mode (`__tls_preview` cookie): sets `ctx.locals.previewToken` / `ctx.locals.previewMode = true`, bypasses
//   the KV page cache, and forces `Cache-Control: private, no-store` + `X-Robots-Tag: noindex`.
// - The CMS-backed pages (/, /blog, /blog/<slug>, /coaching-de-couple, /therapie-individuelle, /sitemap.xml) go through
//   the KV page cache (src/lib/page-cache.ts) on live GET requests.
import { defineMiddleware } from 'astro:middleware'
import { cssFirst } from './lib/css-first.mjs'
import { pageCache, SKIP_CACHE, type Kv } from './lib/page-cache'
import { applyPreviewResponseHeaders, readPreviewCookie } from './lib/tls-edit-attrs'

const CACHED = /^\/(blog(\/[a-z0-9-]+)?|coaching-de-couple|therapie-individuelle|sitemap\.xml)?$/
const NUXT_404_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

export interface WorkerEnv { PAGE_CACHE?: Kv, PREVIEW_NOINDEX?: string, CF_VERSION?: { id: string } }

export async function headersFor(upstream: Response, pathname: string, env: WorkerEnv, previewMode = false): Promise<Response> {
  // Rendered HTML: JS after CSS (src/lib/css-first.mjs). Other bodies stream through (proxied CMS media has immutable headers).
  const html = upstream.headers.get('content-type')?.includes('text/html')
  const res = new Response(html ? cssFirst(await upstream.text()) : upstream.body, upstream)
  res.headers.delete(SKIP_CACHE)
  if (previewMode) {
    applyPreviewResponseHeaders(res.headers, true)
    return res
  }
  if (pathname === '/annuler') res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  else if (res.status === 404 && !pathname.startsWith('/api/')) res.headers.set('X-Robots-Tag', NUXT_404_ROBOTS)
  if (env.PREVIEW_NOINDEX === '1' && !res.headers.has('X-Robots-Tag')) res.headers.set('X-Robots-Tag', 'noindex')
  return res
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next() // build time (Node): no Worker env
  const { pathname } = ctx.url
  if (pathname === '/_tls/preview') return next()
  const previewToken = readPreviewCookie(ctx.request.headers.get('cookie'))
  const previewMode = Boolean(previewToken)
  ctx.locals.previewToken = previewToken
  ctx.locals.previewMode = previewMode

  const { env } = await import('cloudflare:workers')
  const e = env as unknown as WorkerEnv
  if (previewMode) {
    return await headersFor(await next(), pathname, e, true)
  }

  const kv = e.PAGE_CACHE
  if (!kv || ctx.request.method !== 'GET' || !CACHED.test(pathname)) return await headersFor(await next(), pathname, e, false)

  // Query strings (gclid, utm_*) never change these pages: one copy per path, as the prerendered Nuxt pages were.
  // Keyed by Worker version: cached HTML points at this deploy's hashed /_astro assets, which the next deploy removes.
  const key = `html:${e.CF_VERSION?.id ?? 'dev'}:${pathname}`
  const waitUntil = (p: Promise<unknown>): void => {
    const guarded = p.catch(err => console.error('[page-cache]', err))
    ctx.locals.cfContext?.waitUntil(guarded)
  }
  return await headersFor(await pageCache.serve(kv, key, () => next(), waitUntil), pathname, e, false)
})
