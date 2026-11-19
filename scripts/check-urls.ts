// URL-shape check (status codes, Location headers, sitemap, canonicals).
// Local:  bun run build && bunx wrangler dev --config .output/server/wrangler.json --port 8787
//         bun scripts/check-urls.ts http://127.0.0.1:8787
// Prod:   bun scripts/check-urls.ts https://chantalmasse.com https://www.chantalmasse.com
// The www checks need the second argument: the www → apex 301 is a Cloudflare zone rule
// (docs/url-fixes-deploy-notes.md), so it only exists on the real hostname.
import { readdirSync, readFileSync } from 'node:fs'

const APEX = 'https://chantalmasse.com'
const Q = '?gclid=x&utm_source=y'
const base = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/$/, '')
const wwwBase = process.argv[3]?.replace(/\/$/, '')

const results: Record<string, { pass: number, fail: number }> = {}
function check(group: string, ok: boolean, detail: string) {
  const r = (results[group] ??= { pass: 0, fail: 0 })
  if (ok) r.pass++
  else {
    r.fail++
    console.log(`FAIL [${group}] ${detail}`)
  }
}

const get = (url: string) => fetch(url, { redirect: 'manual' })

// Pages from pages/*.vue (+ /blog), posts from content/blog/*.md (file name = slug).
const pages = readdirSync('pages').filter(f => f.endsWith('.vue'))
  .map(f => (f === 'index.vue' ? '/' : `/${f.slice(0, -4)}`))
  .concat('/blog')
const posts = readdirSync('content/blog').filter(f => f.endsWith('.md'))
  .map(f => `/blog/${f.slice(0, -3)}`)

// Legacy redirects: static lines of public/_redirects; the final URL is the no-slash canonical.
const legacy = readFileSync('public/_redirects', 'utf8').split('\n')
  .map(l => l.trim().split(/\s+/))
  .filter(([from, , status]) => from?.startsWith('/') && !from.includes('*') && status === '301')
  .map(([from = '', to = '']) => [from, to.replace(/(.)\/$/, '$1')] as const)

// One request must land on `want` (path + query, absolute when `origin` is given), and `want` must answer 200.
async function expectOneHop(group: string, url: string, want: string, origin = '') {
  const res = await get(url)
  const loc = res.headers.get('location')
  const got = loc ? new URL(loc, url) : null
  const gotStr = got ? (origin ? got.href : got.pathname + got.search) : '(none)'
  const ok = res.status === 301 && gotStr === origin + want
  check(group, ok, `${url} → ${res.status} ${gotStr} (want 301 ${origin + want})`)
  if (!ok || !got) return
  const final = await get(origin ? got.href : base + got.pathname + got.search)
  check(group, final.status === 200, `${url} → ${gotStr} → ${final.status} (want 200, single hop)`)
}

async function expect200(group: string, path: string) {
  const res = await get(base + path + Q)
  check(group, res.status === 200, `${path}${Q} → ${res.status} ${res.headers.get('location') ?? ''} (want 200)`)
  return res.status === 200 ? res.text() : ''
}

const attr = (html: string, re: RegExp) => html.match(re)?.[1]

// 1. Every page and post: /path is 200, /path/ is one 301 to /path (query kept). Canonical, og:url and links have no trailing slash.
for (const path of [...pages, ...posts]) {
  const group = posts.includes(path) ? 'posts' : 'pages'
  const html = await expect200(group, path)
  if (path !== '/') await expectOneHop(group, `${base}${path}/${Q}`, path + Q)
  if (!html || path === '/annuler' || path === '/confirmer-inscription') continue // SSR / token pages: no canonical contract
  const want = path === '/' ? [APEX, `${APEX}/`] : [APEX + path]
  const canonical = attr(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) ?? attr(html, /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/)
  check('canonical', want.includes(canonical ?? ''), `${path} canonical=${canonical}`)
  const ogUrl = attr(html, /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/)
  check('og:url', !ogUrl || want.includes(ogUrl), `${path} og:url=${ogUrl}`)
  const slashLinks = [...html.matchAll(/href="(\/[^"?#]+\/)(?:[?#][^"]*)?"/g)].map(m => m[1] ?? '').filter(h => !h.startsWith('/_nuxt/'))
  check('links', slashLinks.length === 0, `${path} internal links with trailing slash: ${slashLinks.join(' ')}`)
}

// 2. /prendre-rendez-vous stays noindex.
const rdv = await (await get(`${base}/prendre-rendez-vous`)).text()
check('noindex', /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(rdv), '/prendre-rendez-vous has no noindex robots meta')

// 3. Legacy redirects: one 301 to the final URL, gclid/utm kept.
for (const [from, to] of legacy) await expectOneHop('legacy', `${base}${from}${Q}`, to + Q)

// 4. Sitemap: every page/post, no trailing slash, no noindex page, every <loc> answers 200.
const sitemap = await (await get(`${base}/sitemap.xml`)).text()
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1] ?? '')
check('sitemap', locs.length > 0, `sitemap has ${locs.length} <loc>`)
for (const loc of locs) {
  const path = new URL(loc).pathname
  check('sitemap', loc.startsWith(APEX) && (path === '/' || !path.endsWith('/')), `sitemap <loc> ${loc}`)
  check('sitemap', (await get(base + path)).status === 200, `sitemap <loc> ${loc} is not 200`)
}
check('sitemap', !locs.some(l => l.includes('/prendre-rendez-vous')), 'sitemap lists noindex /prendre-rendez-vous')
for (const p of posts) check('sitemap', locs.includes(APEX + p), `sitemap missing ${p}`)

// 5. www → apex, one 301 straight to the final URL (needs the zone rule; prod only).
if (wwwBase) {
  await expectOneHop('www', `${wwwBase}/${Q}`, `/${Q}`, APEX)
  for (const path of [...pages, ...posts].filter(p => p !== '/')) {
    await expectOneHop('www', `${wwwBase}${path}${Q}`, path + Q, APEX)
    await expectOneHop('www', `${wwwBase}${path}/${Q}`, path + Q, APEX)
  }
  for (const [from, to] of legacy) await expectOneHop('www', `${wwwBase}${from}${Q}`, to + Q, APEX)
}
else console.log('SKIP [www] pass the www base URL as 2nd argument (zone rule, prod only)')

console.log(`\n${base}: ${pages.length} pages, ${posts.length} posts, ${legacy.length} legacy redirect sources`)
for (const [group, { pass, fail }] of Object.entries(results)) console.log(`${fail ? 'FAIL' : 'PASS'} ${group.padEnd(10)} ${pass} ok, ${fail} failed`)
process.exit(Object.values(results).some(r => r.fail) ? 1 : 0)
