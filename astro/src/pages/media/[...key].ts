// /media/<key>: CMS media (blog heroes and body images; the engine's Image.src), proxied from the tls-cms SiteReads
// binding: R2 behind Images resizing, immutable sha256 keys. Query (?w=&h=&fit=&q=) and Accept pass through so the engine
// picks size and format. Each variant (key + query + format) is kept in KV after the first request: the engine doesn't
// cache its Images transforms, and a hero waiting on one was the LCP of every post.
import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { SITE_ID } from '../../lib/blog'

export const prerender = false

interface Kv {
  getWithMetadata<M>(key: string, type: 'arrayBuffer'): Promise<{ value: ArrayBuffer | null, metadata: M | null }>
  put(key: string, value: ArrayBuffer, opts: { metadata: unknown }): Promise<void>
}
interface MediaEnv { CMS?: { fetch: (r: Request) => Promise<Response> }, CMS_BASE_URL?: string, PAGE_CACHE?: Kv }
const IMMUTABLE = 'public, max-age=31536000, immutable'

export const GET: APIRoute = async ({ params, request, locals }) => {
  const e = env as unknown as MediaEnv
  const key = params.key ?? ''
  if (!/^[\w./-]+$/.test(key) || key.includes('..')) return new Response('Not found', { status: 404 })
  const { search } = new URL(request.url)
  const accept = request.headers.get('accept') ?? '*/*'
  const format = accept.includes('image/avif') ? 'avif' : accept.includes('image/webp') ? 'webp' : 'orig'
  const cacheKey = `media:${key}${search}|${format}`

  const hit = await e.PAGE_CACHE?.getWithMetadata<{ type: string }>(cacheKey, 'arrayBuffer').catch(() => null)
  if (hit?.value && hit.metadata) return new Response(hit.value, { headers: { 'content-type': hit.metadata.type, 'cache-control': IMMUTABLE, vary: 'Accept' } })

  const url = `/v2/sites/${SITE_ID}/media/${key}${search}`
  const headers = { accept }
  const res = e.CMS ? await e.CMS.fetch(new Request(`https://cms.internal${url}`, { headers })) : e.CMS_BASE_URL ? await fetch(e.CMS_BASE_URL + url, { headers }) : null
  if (!res?.ok) return new Response('Not found', { status: res?.status === 404 || !res ? 404 : 502 })
  const body = await res.arrayBuffer()
  const type = res.headers.get('content-type') ?? 'application/octet-stream'
  if (e.PAGE_CACHE) (locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } }).cfContext?.waitUntil(e.PAGE_CACHE.put(cacheKey, body, { metadata: { type } }).catch(() => {}))
  return new Response(body, { headers: { 'content-type': type, 'cache-control': IMMUTABLE, vary: 'Accept' } })
}
