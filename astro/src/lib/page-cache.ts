// HTML cache for the CMS-backed pages (/, /blog, /blog/<slug>, /sitemap.xml), used by src/middleware.ts. Framework-free
// so tests/unit/page-cache.test.ts can drive it with a fake KV.
// - A cached copy is served at once; once older than FRESH_MS it is re-rendered in the background. Each isolate starts
//   at most one re-render per key per FRESH_MS (stamped before it starts, so a failing CMS is not hit on every request).
// - KV is written only when the HTML changed (writes ≈ publishes), with a TTL so old Worker versions' keys expire.
// - A page that now answers 404 (unpublished or renamed post) is dropped; a cold 404 (bots, typos) costs no KV call.
// - A degraded render (the page set SKIP_CACHE, e.g. home with the CMS down) is served but never cached.
// PAGE_CACHE shares the booking namespace and its daily write/delete budget: every KV write here must stay rare.

/** Response header a page sets when it rendered degraded: served, never cached (the middleware strips it). */
export const SKIP_CACHE = 'x-page-cache-skip'
export const FRESH_MS = 60_000
const TTL_S = 7 * 86400

export interface Kv {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, opts: { expirationTtl: number }): Promise<void>
  delete(key: string): Promise<void>
}
interface Entry { at: number, status: number, type: string, cacheControl: string | null, body: string }

export interface PageCache {
  serve(kv: Kv, key: string, render: () => Promise<Response>, waitUntil: (p: Promise<unknown>) => void): Promise<Response>
  /** Per isolate: when each key's last re-render started or finished. */
  refreshedAt: Map<string, number>
}

export function createPageCache(now: () => number = Date.now): PageCache {
  const refreshedAt = new Map<string, number>()
  const inflight = new Map<string, Promise<void>>()

  async function store(kv: Kv, key: string, res: Response, old: Entry | null): Promise<void> {
    if (res.status === 404) {
      if (!old) return
      // Stamped, not cleared: KV reads stay eventually consistent for ~60 s after the delete, and a cleared stamp would
      // make every request in that window see the stale entry as due and delete it again.
      refreshedAt.set(key, now())
      return kv.delete(key)
    }
    refreshedAt.set(key, now())
    if (res.status !== 200 || res.headers.has(SKIP_CACHE)) return
    const body = await res.text()
    if (old && old.body === body) return
    const entry: Entry = { at: now(), status: 200, type: res.headers.get('content-type') ?? 'text/html', cacheControl: res.headers.get('cache-control'), body }
    await kv.put(key, JSON.stringify(entry), { expirationTtl: TTL_S })
  }

  async function serve(kv: Kv, key: string, render: () => Promise<Response>, waitUntil: (p: Promise<unknown>) => void): Promise<Response> {
    const old = await kv.get(key, 'json').catch(() => null) as Entry | null
    if (!old) {
      const res = await render()
      if (res.status === 200 && !res.headers.has(SKIP_CACHE)) waitUntil(store(kv, key, res.clone(), null))
      return res
    }
    const fresh = Math.max(old.at, refreshedAt.get(key) ?? 0)
    if (now() - fresh > FRESH_MS && !inflight.has(key)) {
      refreshedAt.set(key, now()) // before render(): a rejected refresh also waits FRESH_MS before the next try
      const refresh = render().then(res => store(kv, key, res, old)).finally(() => inflight.delete(key))
      inflight.set(key, refresh)
      waitUntil(refresh)
    }
    const headers = new Headers({ 'content-type': old.type })
    if (old.cacheControl) headers.set('cache-control', old.cacheControl)
    return new Response(old.body, { status: old.status, headers })
  }

  return { serve, refreshedAt }
}

export const pageCache = createPageCache()
