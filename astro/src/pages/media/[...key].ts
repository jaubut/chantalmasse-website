// /media/<key>: CMS media (blog heroes and body images; the engine's Image.src), proxied from the tls-cms SiteReads
// binding: R2 behind Images resizing, immutable sha256 keys.
// - Only the sizes the pages ask for (WIDTHS) reach the engine; any other query is dropped, so a crafted URL can't buy a
//   resize or a cache entry. The format follows Accept (AVIF/WebP/original), as the engine picks it.
// - Only raster images are served, with nosniff.
// - Each variant is cached at the edge (Cache API, production zone) and in KV with a TTL (workers.dev has no Cache API):
//   the engine doesn't cache its Images transforms, and a hero waiting on one was the LCP of every post. KV writes are
//   bounded by posts × WIDTHS × 3 formats and only happen on a miss, so they can't eat the namespace's daily write budget.
import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { SITE_ID } from '../../lib/blog'

export const prerender = false

/** Widths used by the blog templates (src/lib/blog.ts, src/pages/blog/[slug].astro). */
const WIDTHS = new Set(['640', '960', '1200', '1280', '1920'])
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const IMMUTABLE = 'public, max-age=31536000, immutable'
const KV_TTL_S = 30 * 86400

interface Kv {
  getWithMetadata<M>(key: string, type: 'arrayBuffer'): Promise<{ value: ArrayBuffer | null, metadata: M | null }>
  put(key: string, value: ArrayBuffer, opts: { metadata: unknown, expirationTtl: number }): Promise<void>
}
interface MediaEnv { CMS?: { fetch: (r: Request) => Promise<Response> }, CMS_BASE_URL?: string, PAGE_CACHE?: Kv }

const image = (body: ArrayBuffer, type: string): Response => new Response(body, {
  headers: { 'content-type': type, 'cache-control': IMMUTABLE, 'x-content-type-options': 'nosniff', vary: 'Accept' },
})

export const GET: APIRoute = async ({ params, request, locals }) => {
  const e = env as unknown as MediaEnv
  const key = params.key ?? ''
  if (!/^[\w./-]+$/.test(key) || key.includes('..')) return new Response('Not found', { status: 404 })
  const url = new URL(request.url)
  const w = url.searchParams.get('w')
  const search = w && WIDTHS.has(w) ? `?w=${w}` : ''
  const accept = request.headers.get('accept') ?? '*/*'
  const format = accept.includes('image/avif') ? 'avif' : accept.includes('image/webp') ? 'webp' : 'orig'
  const variant = `${key}${search}|${format}`
  const edgeKey = new Request(`${url.origin}/media/${key}${search}${search ? '&' : '?'}f=${format}`)
  const waitUntil = (p: Promise<unknown>): void => {
    const guarded = p.catch(err => console.error('[media-cache]', err))
    ;(locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext?.waitUntil(guarded)
  }

  const edge = typeof caches === 'undefined' ? undefined : (caches as unknown as { default: Cache }).default
  const edgeHit = await edge?.match(edgeKey).catch(() => undefined)
  if (edgeHit) return edgeHit
  const hit = await e.PAGE_CACHE?.getWithMetadata<{ type: string }>(`media:${variant}`, 'arrayBuffer').catch(() => null)
  if (hit?.value && hit.metadata && TYPES.has(hit.metadata.type)) return image(hit.value, hit.metadata.type)

  const path = `/v2/sites/${SITE_ID}/media/${key}${search}`
  const headers = { accept }
  const res = e.CMS ? await e.CMS.fetch(new Request(`https://cms.internal${path}`, { headers })) : e.CMS_BASE_URL ? await fetch(e.CMS_BASE_URL + path, { headers }) : null
  if (!res?.ok) return new Response('Not found', { status: res?.status === 404 || !res ? 404 : 502 })
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
  if (!TYPES.has(type)) return new Response('Not found', { status: 404 })
  const body = await res.arrayBuffer()
  if (edge) waitUntil(edge.put(edgeKey, image(body, type)))
  if (e.PAGE_CACHE) waitUntil(e.PAGE_CACHE.put(`media:${variant}`, body, { metadata: { type }, expirationTtl: KV_TTL_S }))
  return image(body, type)
}
