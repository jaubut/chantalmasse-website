// Response headers and the HTML cache for the routes rendered on the Worker.
// - X-Robots-Tag as the Nuxt Worker sent it (routeRules robots:false): /annuler here, the static /confirmer-inscription in
//   dist/client/_headers (astro.config.mjs), and @nuxtjs/robots' default directives on 404s.
// - Preview Worker (PREVIEW_NOINDEX=1): every other rendered response says noindex too.
// - The CMS-backed pages (/, /blog, /blog/<slug>, /sitemap.xml) go through the KV page cache (src/lib/page-cache.ts):
//   a post published in the portal shows up within about a minute, with no rebuild.
import { defineMiddleware } from 'astro:middleware'
import { cssFirst } from './lib/css-first.mjs'
import { pageCache, SKIP_CACHE, type Kv } from './lib/page-cache'

const CACHED = /^\/(blog(\/[a-z0-9-]+)?|sitemap\.xml)?$/
const NUXT_404_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

interface WorkerEnv { PAGE_CACHE?: Kv, PREVIEW_NOINDEX?: string, CF_VERSION?: { id: string } }

async function headersFor(upstream: Response, pathname: string, env: WorkerEnv): Promise<Response> {
  // Rendered HTML: JS after CSS (src/lib/css-first.mjs). Other bodies stream through (proxied CMS media has immutable headers).
  const html = upstream.headers.get('content-type')?.includes('text/html')
  const res = new Response(html ? cssFirst(await upstream.text()) : upstream.body, upstream)
  res.headers.delete(SKIP_CACHE)
  if (pathname === '/annuler') res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  else if (res.status === 404 && !pathname.startsWith('/api/')) res.headers.set('X-Robots-Tag', NUXT_404_ROBOTS)
  if (env.PREVIEW_NOINDEX === '1' && !res.headers.has('X-Robots-Tag')) res.headers.set('X-Robots-Tag', 'noindex')
  return res
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next() // build time (Node): no Worker env
  const { env } = await import('cloudflare:workers')
  const e = env as unknown as WorkerEnv
  const { pathname } = ctx.url
  const kv = e.PAGE_CACHE
  if (!kv || ctx.request.method !== 'GET' || !CACHED.test(pathname)) return await headersFor(await next(), pathname, e)

  // Query strings (gclid, utm_*) never change these pages: one copy per path, as the prerendered Nuxt pages were.
  // Keyed by Worker version: cached HTML points at this deploy's hashed /_astro assets, which the next deploy removes.
  const key = `html:${e.CF_VERSION?.id ?? 'dev'}:${pathname}`
  const waitUntil = (p: Promise<unknown>): void => {
    const guarded = p.catch(err => console.error('[page-cache]', err))
    ;(ctx.locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext?.waitUntil(guarded)
  }
  return await headersFor(await pageCache.serve(kv, key, () => next(), waitUntil), pathname, e)
})
