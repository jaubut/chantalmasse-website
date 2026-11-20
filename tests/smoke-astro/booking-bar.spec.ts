// Astro build only (playwright.astro.config.ts): the layout's mobile booking bar is suppressed on the booking LP and on
// transactional pages. Nuxt's app.vue rendered it everywhere, so on /prendre-rendez-vous a second, service-less bar sat
// on top of the LP's own bar and opened booking without the Ads deep link's service.
import type { Route } from '@playwright/test'
import { expect, test, waitForHydration } from '../smoke/fixtures'

test.use({ viewport: { width: 390, height: 844 } })

const bars = (page: import('@playwright/test').Page) => page.locator('div.fixed.inset-x-0.bottom-0')

test('/prendre-rendez-vous: only the LP\'s own service-aware bar, and it keeps ?service=couple', async ({ page }) => {
  await page.route('**/api/booking/availability**', (route: Route) => {
    const url = new URL(route.request().url())
    return route.fulfill({ json: { month: url.searchParams.get('month'), service: url.searchParams.get('service'), availableDates: [], slotsByDate: {} } })
  })
  await page.goto('/prendre-rendez-vous?service=couple')
  await waitForHydration(page)
  await page.waitForTimeout(1500) // past client:idle hydration of any layout island
  await expect(bars(page)).toHaveCount(0) // the LP bar waits for the hero to scroll away; no layout bar at all

  await page.locator('[data-lp-hero]').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY + 50))
  await expect(bars(page)).toHaveCount(1)
  const bar = bars(page).getByRole('button')
  await expect(bar).toHaveText('Réserver — Coaching couple')

  const availability = page.waitForRequest((req) => req.url().includes('/api/booking/availability'))
  await bar.click()
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', 'Choisir une date') // service step skipped
  expect(new URL((await availability).url()).searchParams.get('service')).toBe('couple')
})

for (const path of ['/annuler', '/confirmer-inscription', '/inscription-confirmee']) {
  test(`${path}: no booking bar`, async ({ page, guard }) => {
    guard.allowConsole.push(/status of 4\d\d/) // /annuler without a token answers 400 by design
    await page.goto(path)
    await waitForHydration(page)
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    await expect(bars(page)).toHaveCount(0)
  })
}

test('/coaching-de-couple: the layout bar is still there (single bar; no #hero on this page, so shown from the start)', async ({ page }) => {
  await page.goto('/coaching-de-couple')
  await waitForHydration(page)
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
  await expect(bars(page)).toHaveCount(1)
})
