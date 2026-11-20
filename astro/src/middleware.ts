// Response headers and the HTML cache for the routes rendered on the Worker.
// - X-Robots-Tag as the Nuxt Worker sent it (routeRules robots:false): /annuler here, the static /confirmer-inscription in
//   dist/client/_headers (astro.config.mjs), and @nuxtjs/robots' default directives on 404s.
// - Preview Worker (PREVIEW_NOINDEX=1): every other rendered response says noindex too.
// - The CMS-backed pages (/, /blog, /blog/<slug>, /sitemap.xml) are served from KV (PAGE_CACHE) and re-rendered in the
//   background once the copy is older than FRESH_MS, so a visitor never waits on the CMS: a post published in the portal
//   shows up within about a minute, with no rebuild. KV is written only when the HTML changed (writes ≈ publishes), with
//   a 7-day TTL (old Worker versions' keys expire); each isolate re-renders a given page at most once per FRESH_MS, and a
//   page that now answers 404 (unpublished or renamed post) is dropped from the cache.
import { defineMiddleware } from 'astro:middleware'
import { cssFirst } from './lib/css-first.mjs'

/** Response header a page sets when it rendered degraded (CMS down): served, never cached, stripped here. */
export const SKIP_CACHE = 'x-page-cache-skip'
const FRESH_MS = 60_000
const TTL_S = 7 * 86400
/** Per isolate: when each key was last re-rendered (changed or not), and the re-render in flight. */
const refreshedAt = new Map<string, number>()
const inflight = new Map<string, Promise<void>>()
const CACHED = /^\/(blog(\/[a-z0-9-]+)?|sitemap\.xml)?$/
const NUXT_404_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

interface Kv {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, opts: { expirationTtl: number }): Promise<void>
  delete(key: string): Promise<void>
}
interface Entry { at: number, status: number, type: string, cacheControl: string | null, body: string }
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

async function store(kv: Kv, key: string, res: Response, old: Entry | null): Promise<void> {
  refreshedAt.set(key, Date.now())
  if (res.status === 404) return kv.delete(key)
  if (res.status !== 200 || res.headers.has(SKIP_CACHE)) return
  const body = await res.text()
  if (old && old.body === body) return
  const entry: Entry = { at: Date.now(), status: 200, type: res.headers.get('content-type') ?? 'text/html', cacheControl: res.headers.get('cache-control'), body }
  await kv.put(key, JSON.stringify(entry), { expirationTtl: TTL_S })
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
  const old = await kv.get(key, 'json').catch(() => null) as Entry | null
  const waitUntil = (p: Promise<unknown>): void => {
    const guarded = p.catch(err => console.error('[page-cache]', err))
    ;(ctx.locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext?.waitUntil(guarded)
  }
  if (!old) {
    const res = await next()
    waitUntil(store(kv, key, res.clone(), null))
    return await headersFor(res, pathname, e)
  }
  const fresh = Math.max(old.at, refreshedAt.get(key) ?? 0)
  if (Date.now() - fresh > FRESH_MS && !inflight.has(key)) {
    const refresh = next().then(res => store(kv, key, res, old)).finally(() => inflight.delete(key))
    inflight.set(key, refresh)
    waitUntil(refresh)
  }
  const headers = new Headers({ 'content-type': old.type })
  if (old.cacheControl) headers.set('cache-control', old.cacheControl)
  return await headersFor(new Response(old.body, { status: old.status, headers }), pathname, e)
})
