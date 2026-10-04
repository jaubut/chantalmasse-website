import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, test, waitForHydration } from './fixtures'

// Every routable page in pages/ with the heading that proves it rendered.
// A new page without an entry here fails the "inventory" test on purpose.
const PAGES: Record<string, { heading: RegExp; level?: 'h1' | 'h2' }> = {
  '/': { heading: /Thérapeute en relation d'aide à Shefford/ },
  '/journey': { heading: /Le chemin vers toi-même commence ici/, level: 'h2' },
  '/blog': { heading: /^Le blogue$/ },
  '/coaching-de-couple': { heading: /manque d'outils/ },
  '/therapie-individuelle': { heading: /Tu as de la valeur/ },
  '/prendre-rendez-vous': { heading: /Réserve ta séance avec Chantal/ },
  '/mentions-legales': { heading: /^Mentions Légales$/ },
  '/confidentialite': { heading: /^Politique de confidentialité$/ },
  '/inscription-confirmee': { heading: /Merci pour votre inscription/ },
  '/annuler': { heading: /^Lien invalide$/ },
}

function routesFromPagesDir(): string[] {
  const root = join(process.cwd(), 'pages')
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
  return walk(root)
    .filter((f) => f.endsWith('.vue') && !/\[.+\]/.test(f))
    .map((f) => `/${relative(root, f).replace(/\.vue$/, '').replace(/(^|\/)index$/, '')}`.replace(/\/$/, '') || '/')
}

test('inventory: every static page in pages/ is covered by the smoke suite', () => {
  expect(routesFromPagesDir().sort()).toEqual(Object.keys(PAGES).sort())
})

for (const [path, { heading, level = 'h1' }] of Object.entries(PAGES)) {
  test(`${path} renders in French with its key heading and all images`, async ({ page }) => {
    const res = await page.goto(path)
    expect(res?.status(), `HTTP status of ${path}`).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page).toHaveTitle(/Chantal Massé/)
    await expect(page.locator(level).first()).toBeVisible()
    const headings = await page.locator(level).evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()))
    expect(headings.some((t) => heading.test(t)), `${level} on ${path}: ${JSON.stringify(headings)}`).toBe(true)
    await waitForHydration(page)

    // French copy is present in the rendered page (nav/footer + body).
    const text = await page.locator('body').innerText()
    expect(text).toMatch(/\b(Chantal|séance|rendez-vous|thérapie|couple)\b/i)

    // Scroll through so lazy images load, then require every <img> to decode.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 40))
      }
    })
    await page.waitForLoadState('networkidle')
    const broken = await page.locator('img').evaluateAll((imgs) =>
      (imgs as HTMLImageElement[])
        .filter((img) => img.currentSrc && img.complete && img.naturalWidth === 0)
        .map((img) => img.currentSrc))
    expect(broken, 'images that failed to load').toEqual([])
  })
}

test('the hero portrait is served by the site itself', async ({ page }) => {
  const res = await page.request.get('/images/chantal-hero.jpg')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/jpeg')
})

test('unknown pages show the French 404 page', async ({ page, guard }) => {
  guard.allowConsole.push(/404/)
  const res = await page.goto('/cette-page-nexiste-pas')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: "Cette page n'existe pas" })).toBeVisible()
  guard.badAssets.length = 0 // the 404 document itself is expected
})

test.describe('legacy Wix URLs keep their 301s', () => {
  for (const [from, to] of [
    ['/coaching-relationnel-couple', '/coaching-de-couple'],
    ['/coaching-relationnel-de-couple-chantal', '/coaching-de-couple'],
    ['/therapie-individuelle-chantal', '/therapie-individuelle'],
    ['/book-online', '/'],
    ['/booking-calendar', '/'],
  ]) {
    test(`${from} → ${to}`, async ({ request }) => {
      const res = await request.get(from!, { maxRedirects: 0 })
      expect(res.status()).toBe(301)
      expect(new URL(res.headers().location!, 'http://x').pathname).toBe(to)
    })
  }
})

test('client-side navigation works (router)', async ({ page }) => {
  await page.goto('/')
  await waitForHydration(page)
  await page.locator('nav').getByRole('link', { name: 'Blog' }).first().click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Le blogue' })).toBeVisible()
  await page.getByRole('link', { name: 'Mentions Légales' }).click()
  await expect(page).toHaveURL(/\/mentions-legales$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Mentions Légales' })).toBeVisible()
})

test('design system CSS is applied (Tailwind theme, fonts)', async ({ page }) => {
  await page.goto('/')
  const cta = page.getByRole('button', { name: 'Prendre rendez-vous' }).first()
  await expect(cta).toBeVisible()
  const style = await cta.evaluate((el) => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, color: s.color, paddingLeft: s.paddingLeft, radius: s.borderTopLeftRadius }
  })
  // bg-secondary / text-on-secondary / px-10 / rounded-xl from tailwind.config.ts
  expect(style).toEqual({ bg: 'rgb(81, 93, 133)', color: 'rgb(255, 255, 255)', paddingLeft: '40px', radius: '8px' })
  const h1Font = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily)
  expect(h1Font).toContain('Newsreader')
  const bodyBg = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bodyBg).toBe('rgb(254, 248, 243)')
})

test('SEO files are generated', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const xml = await sitemap.text()
  for (const path of ['/', '/blog', '/coaching-de-couple', '/therapie-individuelle', '/prendre-rendez-vous']) {
    expect(xml).toContain(`<loc>https://chantalmasse.com${path}</loc>`)
  }
  expect(xml).not.toContain('/inscription-confirmee')
})

test('sitemap lists every blog article with its frontmatter date as lastmod', async ({ request }) => {
  const dir = join(process.cwd(), 'content/blog')
  const articles = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const fm = readFileSync(join(dir, f), 'utf8')
    return { slug: fm.match(/^slug:\s*(\S+)/m)![1], date: fm.match(/^date:\s*(\S+)/m)![1] }
  })
  expect(articles.length).toBeGreaterThan(0)
  const xml = await (await request.get('/sitemap.xml')).text()
  for (const { slug, date } of articles) {
    // The article itself is prerendered and served...
    expect((await request.get(`/blog/${slug}`)).status(), `/blog/${slug}`).toBe(200)
    // ...and listed in the sitemap with its publication date.
    const entry = xml.match(new RegExp(`<url>\\s*<loc>https://chantalmasse.com/blog/${slug}</loc>[\\s\\S]*?</url>`))
    expect(entry, `/blog/${slug} in sitemap`).not.toBeNull()
    expect(entry![0], `lastmod of /blog/${slug}`).toContain(`<lastmod>${date}`)
  }
})
