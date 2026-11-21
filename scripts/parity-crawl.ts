// Parity crawl for the Nuxt → Astro migration (docs/astro-migration-plan.md, Stage 0/2).
//   Snapshot: bun scripts/parity-crawl.ts snapshot https://chantalmasse.com > docs/migration-baseline/crawl.json
//   Compare:  bun scripts/parity-crawl.ts diff docs/migration-baseline/crawl.json <base-or-snapshot.json> [--preview]
//             (a base URL is crawled on the baseline's URL set)
// Records per URL: status, Location (origin stripped), title, description, canonical, robots meta, og:*/twitter:*,
// JSON-LD (parsed), <h1>, <html lang>. Plus the sitemap <loc> set and the robots.txt body. The preview host is
// rewritten to the apex in every value, so a snapshot of a preview compares 1:1 with production.
import { readFileSync } from 'node:fs'

const APEX = 'https://chantalmasse.com'
const Q = '?gclid=test&utm_source=test'

type Entry = Record<string, unknown>
type Snapshot = { base: string, urls: Record<string, Entry>, sitemap: string[], robots: string }

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const metas = (html: string) => {
  const out: Record<string, string> = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:name|property)="([^"]+)"/i)?.[1]
    // A bare `content` attribute (no value) is an empty description: Nuxt emits that on blog posts.
    const c = tag.match(/\bcontent(?:="([^"]*)")?(?=[\s/>])/i)
    const content = c ? (c[1] ?? '') : undefined
    if (key && content !== undefined && /^(description|robots|og:|twitter:)/.test(key)) out[key] = decode(content)
  }
  return out
}

function page(html: string): Entry {
  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => { try { return JSON.parse(m[1]!) } catch { return { unparsable: m[1] } } })
  return {
    lang: html.match(/<html[^>]*\blang="([^"]+)"/i)?.[1] ?? null,
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''),
    canonical: html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1] ?? html.match(/<link[^>]*href="([^"]+)"[^>]*rel="canonical"/i)?.[1] ?? null,
    meta: metas(html),
    h1: decode((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, " ").trim()),
    jsonLd,
  }
}

async function snapshot(base: string, only?: string[]): Promise<Snapshot> {
  base = base.replace(/\/$/, '')
  const host = (s: string) => s.split(base).join(APEX)
  const sitemapXml = await (await fetch(`${base}/sitemap.xml`)).text()
  const sitemap = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => host(m[1]!)).sort()
  const robots = host(await (await fetch(`${base}/robots.txt`)).text())

  const paths = new Set<string>()
  for (const loc of sitemap) {
    const p = new URL(loc).pathname
    paths.add(p)
    if (p !== '/') paths.add(`${p}/`)
  }
  for (const p of ['/prendre-rendez-vous', '/inscription-confirmee', '/confirmer-inscription', '/annuler', '/annuler?token=bad', '/nope', '/blog/nope', '/api/nope'])
    paths.add(p)
  const legacy = readFileSync('public/_redirects', 'utf8').split('\n').map(l => l.trim().split(/\s+/)[0] ?? '')
    .filter(from => from.startsWith('/') && !from.includes('*'))
  for (const from of legacy) paths.add(from + Q)
  paths.add(`/coaching-de-couple/${Q}`)
  // Compare mode: crawl exactly the baseline's URL set, whatever this host's sitemap says.
  if (only) { paths.clear(); for (const p of only) paths.add(p) }

  const urls: Record<string, Entry> = {}
  for (const path of [...paths].sort()) {
    const res = await fetch(base + path, { redirect: 'manual' })
    const loc = res.headers.get('location')
    const entry: Entry = { status: res.status }
    if (loc) entry.location = host(new URL(loc, base + path).href).replace(APEX, '')
    const xrobots = res.headers.get('x-robots-tag')
    if (xrobots) entry.xRobotsTag = xrobots
    if (res.status === 200 && (res.headers.get('content-type') ?? '').includes('text/html'))
      Object.assign(entry, JSON.parse(host(JSON.stringify(page(await res.text())))))
    else await res.body?.cancel()
    urls[path] = entry
  }
  return { base, urls, sitemap, robots }
}

const load = async (arg: string, only?: string[]): Promise<Snapshot> => arg.endsWith('.json') ? JSON.parse(readFileSync(arg, 'utf8')) : snapshot(arg, only)

// The preview Worker adds `noindex` to X-Robots-Tag on purpose (never indexed): compare directive sets minus that.
function diff(a: unknown, b: unknown, path: string, out: string[], ignore: Set<string>) {
  if (ignore.has('xRobotsTag') && path.endsWith('.xRobotsTag')) {
    const set = (v: unknown): Set<string> => new Set(String(v ?? '').split(',').map(s => s.trim()).filter(Boolean))
    const [base, preview] = [set(a), set(b)]
    if (!base.has('noindex')) preview.delete('noindex')
    if ([...base].sort().join() !== [...preview].sort().join()) out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`)
    return
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff((a as Entry)[k], (b as Entry)[k], `${path}.${k}`, out, ignore)
    return
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`)
}

const [cmd, a, b] = process.argv.slice(2)
if (cmd === 'snapshot' && a) {
  console.log(JSON.stringify(await snapshot(a), null, 2))
} else if (cmd === 'diff' && a && b) {
  const left = await load(a)
  const right = await load(b, Object.keys(left.urls))
  // --preview: X-Robots-Tag may carry an extra `noindex` (the preview is never indexed); every other directive must match.
  const ignore = new Set(process.argv.includes('--preview') ? ['xRobotsTag'] : [])
  const out: string[] = []
  diff(left.urls, right.urls, 'urls', out, ignore)
  diff(left.sitemap, right.sitemap, 'sitemap', out, ignore)
  diff(left.robots, right.robots, 'robots', out, ignore)
  console.log(out.length ? out.join('\n') : `ZERO DIFFS: ${Object.keys(left.urls).length} URLs, ${left.sitemap.length} sitemap <loc>, robots.txt`)
  process.exit(out.length ? 1 : 0)
} else {
  console.error('usage: parity-crawl.ts snapshot <base> | diff <a.json|base> <b.json|base> [--preview]')
  process.exit(2)
}
