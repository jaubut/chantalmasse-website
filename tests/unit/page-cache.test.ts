import { describe, expect, it, vi } from 'vitest'
import { createPageCache, FRESH_MS, SKIP_CACHE, type Kv } from '../../astro/src/lib/page-cache'

function fakeKv(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]))
  const kv = {
    get: vi.fn(async (key: string) => (data.has(key) ? JSON.parse(data.get(key)!) : null)),
    put: vi.fn(async (key: string, value: string) => { data.set(key, value) }),
    delete: vi.fn(async (key: string) => { data.delete(key) }),
  }
  return { kv: kv as unknown as Kv & typeof kv, data }
}

const KEY = 'html:v1:/blog/x'
const entry = (at: number, body = '<p>old</p>') => ({ at, status: 200, type: 'text/html', cacheControl: null, body })
const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } })

/** Collects waitUntil promises so a test can await the background work. */
function bg() {
  const tasks: Promise<unknown>[] = []
  return { waitUntil: (p: Promise<unknown>) => { tasks.push(p.catch(() => {})) }, flush: () => Promise.all(tasks) }
}

describe('page cache', () => {
  it('cold 404 (bot, typo): no KV write or delete, no refreshedAt entry', async () => {
    const { kv } = fakeKv()
    const cache = createPageCache(() => 1_000_000)
    const { waitUntil, flush } = bg()
    const res = await cache.serve(kv, KEY, async () => html('nope', 404), waitUntil)
    await flush()
    expect(res.status).toBe(404)
    expect(kv.delete).not.toHaveBeenCalled()
    expect(kv.put).not.toHaveBeenCalled()
    expect(cache.refreshedAt.has(KEY)).toBe(false)
  })

  it('warm 404 (post unpublished): one kv.delete, then no repeat delete while KV still returns the stale entry', async () => {
    let t = 1_000_000
    const { kv, data } = fakeKv({ [KEY]: entry(t) })
    const cache = createPageCache(() => t)
    t += FRESH_MS + 1
    const { waitUntil, flush } = bg()
    const res = await cache.serve(kv, KEY, async () => html('gone', 404), waitUntil)
    expect(await res.text()).toBe('<p>old</p>') // this request still gets the cached copy
    await flush()
    expect(kv.delete).toHaveBeenCalledTimes(1)
    expect(data.has(KEY)).toBe(false)
    expect(cache.refreshedAt.get(KEY)).toBe(t) // stamped: the next FRESH_MS needs no second delete

    // KV is eventually consistent: other colos may still read the deleted entry for a while.
    data.set(KEY, JSON.stringify(entry(1_000_000)))
    t += 1_000
    for (let i = 0; i < 5; i++) await cache.serve(kv, KEY, async () => html('gone', 404), waitUntil)
    await flush()
    expect(kv.delete).toHaveBeenCalledTimes(1)
  })

  it('warm refresh that rejects (CMS down) backs off for FRESH_MS instead of re-rendering on every request', async () => {
    let t = 1_000_000
    const { kv } = fakeKv({ [KEY]: entry(t) })
    const cache = createPageCache(() => t)
    t += FRESH_MS + 1
    const render = vi.fn(async () => { throw new Error('cms 503') })
    const { waitUntil, flush } = bg()
    await cache.serve(kv, KEY, render, waitUntil)
    await flush()
    expect(render).toHaveBeenCalledTimes(1)
    expect(cache.refreshedAt.get(KEY)).toBe(t)

    t += 1_000 // well inside FRESH_MS: served from cache, no new render
    for (let i = 0; i < 5; i++) expect((await cache.serve(kv, KEY, render, waitUntil)).status).toBe(200)
    await flush()
    expect(render).toHaveBeenCalledTimes(1)

    t += FRESH_MS // backoff elapsed: one more attempt
    await cache.serve(kv, KEY, render, waitUntil)
    await flush()
    expect(render).toHaveBeenCalledTimes(2)
    expect(kv.put).not.toHaveBeenCalled()
    expect(kv.delete).not.toHaveBeenCalled()
  })

  it('cold 200 is stored once; a degraded render (SKIP_CACHE) is served but never stored', async () => {
    const { kv } = fakeKv()
    const cache = createPageCache(() => 1_000_000)
    const { waitUntil, flush } = bg()
    await cache.serve(kv, KEY, async () => html('<p>ok</p>'), waitUntil)
    await cache.serve(kv, 'html:v1:/', async () => html('<p>no cards</p>', 200, { [SKIP_CACHE]: '1' }), waitUntil)
    await flush()
    expect(kv.put).toHaveBeenCalledTimes(1)
    expect(kv.put.mock.calls[0]![0]).toBe(KEY)
  })

  it('warm refresh with unchanged HTML writes nothing; changed HTML writes once', async () => {
    let t = 1_000_000
    const { kv } = fakeKv({ [KEY]: entry(t) })
    const cache = createPageCache(() => t)
    const { waitUntil, flush } = bg()
    t += FRESH_MS + 1
    await cache.serve(kv, KEY, async () => html('<p>old</p>'), waitUntil)
    await flush()
    expect(kv.put).not.toHaveBeenCalled()
    t += FRESH_MS + 1
    await cache.serve(kv, KEY, async () => html('<p>new</p>'), waitUntil)
    await flush()
    expect(kv.put).toHaveBeenCalledTimes(1)
  })
})
