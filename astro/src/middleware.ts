// Response headers and the HTML cache for the routes rendered on the Worker.
// - X-Robots-Tag as the Nuxt Worker sent it (routeRules robots:false): /annuler here, the static /confirmer-inscription in
//   dist/client/_headers (astro.config.mjs), and @nuxtjs/robots' default directives on 404s.
// - Preview Worker (PREVIEW_NOINDEX=1): every other rendered response says noindex too.
// - The CMS-backed pages (/, /blog, /blog/<slug>, /sitemap.xml) are served from KV (PAGE_CACHE) and re-rendered in the
//   background once the copy is older than FRESH_MS, so a visitor never waits on the CMS: a post published in the portal
//   shows up within about a minute, with no rebuild. KV is written only when the HTML changed (writes ≈ publishes).
import { defineMiddleware } from 'astro:middleware'

const FRESH_MS = 60_000
const CACHED = /^\/(blog(\/[a-z0-9-]+)?|sitemap\.xml)?$/
const NUXT_404_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

interface Kv {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string): Promise<void>
}
interface Entry { at: number, status: number, type: string, cacheControl: string | null, body: string }
interface WorkerEnv { PAGE_CACHE?: Kv, PREVIEW_NOINDEX?: string, CF_VERSION?: { id: string } }

function headersFor(upstream: Response, pathname: string, env: WorkerEnv): Response {
  const res = new Response(upstream.body, upstream) // proxied responses (CMS media) have immutable headers
  if (pathname === '/annuler') res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  else if (res.status === 404 && !pathname.startsWith('/api/')) res.headers.set('X-Robots-Tag', NUXT_404_ROBOTS)
  if (env.PREVIEW_NOINDEX === '1' && !res.headers.has('X-Robots-Tag')) res.headers.set('X-Robots-Tag', 'noindex')
  return res
}

async function store(kv: Kv, key: string, res: Response, old: Entry | null): Promise<void> {
  if (res.status !== 200) return
  const body = await res.text()
  if (old && old.body === body) return
  const entry: Entry = { at: Date.now(), status: 200, type: res.headers.get('content-type') ?? 'text/html', cacheControl: res.headers.get('cache-control'), body }
  await kv.put(key, JSON.stringify(entry))
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next() // build time (Node): no Worker env
  const { env } = await import('cloudflare:workers')
  const e = env as unknown as WorkerEnv
  const { pathname } = ctx.url
  const kv = e.PAGE_CACHE
  if (!kv || ctx.request.method !== 'GET' || !CACHED.test(pathname)) return headersFor(await next(), pathname, e)

  // Query strings (gclid, utm_*) never change these pages: one copy per path, as the prerendered Nuxt pages were.
  // Keyed by Worker version: cached HTML points at this deploy's hashed /_astro assets, which the next deploy removes.
  const key = `html:${e.CF_VERSION?.id ?? 'dev'}:${pathname}`
  const old = await kv.get(key, 'json').catch(() => null) as Entry | null
  const waitUntil = (p: Promise<unknown>): void => (ctx.locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext?.waitUntil(p.catch(err => console.error('[page-cache]', err)))
  if (!old) {
    const res = await next()
    waitUntil(store(kv, key, res.clone(), null))
    return headersFor(res, pathname, e)
  }
  if (Date.now() - old.at > FRESH_MS) waitUntil(next().then(res => store(kv, key, res, old)))
  const headers = new Headers({ 'content-type': old.type })
  if (old.cacheControl) headers.set('cache-control', old.cacheControl)
  return headersFor(new Response(old.body, { status: old.status, headers }), pathname, e)
})
