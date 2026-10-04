import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, waitForHydration } from './fixtures'

const slugs = readdirSync(join(process.cwd(), 'content/blog'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''))

test('the blog index lists every article', async ({ page }) => {
  await page.goto('/blog')
  for (const slug of slugs) {
    await expect(page.locator(`a[href="/blog/${slug}"]`).first(), slug).toBeAttached()
  }
})

test('an article renders its markdown body', async ({ page }) => {
  const res = await page.goto('/blog/l-amour-conscient')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toContainText("L'amour conscient")
  // Markdown → HTML: section headings, a blockquote, bold text.
  await expect(page.getByRole('heading', { level: 2, name: /Comprendre le mode réaction/ })).toBeVisible()
  await expect(page.locator('blockquote').first()).toContainText('relation où l')
  await expect(page.locator('article strong, .prose strong').first()).toBeVisible()
  // Typography plugin styles the prose headings in the primary colour.
  const h2Color = await page.getByRole('heading', { level: 2, name: /Comprendre le mode réaction/ }).evaluate((el) => getComputedStyle(el).color)
  expect(h2Color).toBe('rgb(23, 48, 40)')
})

test('the newest article is reachable from the home page', async ({ page }) => {
  await page.goto('/')
  await waitForHydration(page)
  const card = page.locator('a[href^="/blog/"]').first()
  const href = await card.getAttribute('href')
  await card.click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('every article is prerendered and answers 200', async ({ request }) => {
  for (const slug of slugs) {
    const res = await request.get(`/blog/${slug}`)
    expect(res.status(), slug).toBe(200)
    expect(await res.text(), slug).toContain('<h1')
  }
})
