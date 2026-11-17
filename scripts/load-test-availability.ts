// Load test for GET /api/booking/availability against a Worker preview URL.
//   bun scripts/load-test-availability.ts <base-url> [requests=200] [concurrency=10]
// Mixes the bookable months × both services, like real visitors paging the
// calendar. Prints latency percentiles, errors and the Server-Timing cache
// status (hit/stale/miss/fallback) when the version reports it.
const [base, total = '200', concurrency = '10'] = process.argv.slice(2)
if (!base) {
  console.error('usage: bun scripts/load-test-availability.ts <base-url> [requests] [concurrency]')
  process.exit(1)
}

const now = new Date()
const months = [0, 1, 2].map((i) => {
  const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})
const urls = months.flatMap(m => ['individual', 'couple'].map(s => `${base}/api/booking/availability?month=${m}&service=${s}`))

const times: number[] = []
const statuses = new Map<string, number>()
const cache = new Map<string, number>()
let next = 0
let firstError = ''

async function worker(): Promise<void> {
  while (next < Number(total)) {
    const url = urls[next++ % urls.length]!
    const t0 = performance.now()
    let key: string
    try {
      const res = await fetch(url)
      key = String(res.status)
      if (!res.ok && !firstError) firstError = `${res.status} ${url}: ${(await res.clone().text()).slice(0, 200)}`
      await res.arrayBuffer()
      const desc = res.headers.get('server-timing')?.match(/desc="(\w+)"/)?.[1]
      if (desc) cache.set(desc, (cache.get(desc) ?? 0) + 1)
    } catch (err) {
      key = `network: ${(err as Error).message}`
    }
    times.push(performance.now() - t0)
    statuses.set(key, (statuses.get(key) ?? 0) + 1)
  }
}

await Promise.all(Array.from({ length: Number(concurrency) }, worker))

times.sort((a, b) => a - b)
const pct = (p: number) => Math.round(times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)] ?? 0)
const errors = [...statuses].filter(([s]) => s !== '200').reduce((n, [, c]) => n + c, 0)
console.log(JSON.stringify({
  requests: times.length,
  concurrency: Number(concurrency),
  p50: pct(50), p95: pct(95), p99: pct(99), max: Math.round(times.at(-1) ?? 0),
  errors,
  statuses: Object.fromEntries(statuses),
  cache: Object.fromEntries(cache),
  ...(firstError ? { firstError } : {}),
}))
