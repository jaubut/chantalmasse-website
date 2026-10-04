// Shared smoke-test guard, applied to every test automatically:
//  - third-party requests (GA4, Meta Pixel, PostHog, Wix CDN, fonts) never
//    leave the machine: they're answered locally so CI never pollutes
//    Chantal's analytics and never flakes on someone else's CDN;
//  - any console error / uncaught exception fails the test;
//  - any same-origin asset answering >= 400 fails the test.
import { test as base, expect, type Page, type Request } from '@playwright/test'

// 1×1 transparent PNG served for external images.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

// External image hosts the site references today (blog covers, Philosophy
// section). A new host fails the suite so it gets reviewed.
export const ALLOWED_IMAGE_HOSTS = [/(^|\.)wixstatic\.com$/, /^images\.unsplash\.com$/, /(^|\.)cdninstagram\.com$/, /(^|\.)fbcdn\.net$/]

export interface Guard {
  consoleErrors: string[]
  badAssets: string[]
  externalImages: string[]
  /** Console errors matching these are expected by the current test. */
  allowConsole: RegExp[]
}

export const test = base.extend<{ guard: Guard }>({
  guard: [async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin
    const guard: Guard = { consoleErrors: [], badAssets: [], externalImages: [], allowConsole: [] }

    await page.context().route((url) => url.origin !== origin && /^https?:$/.test(url.protocol), async (route, request: Request) => {
      const type = request.resourceType()
      if (type === 'image') {
        guard.externalImages.push(request.url())
        return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
      }
      if (type === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
      return route.fulfill({ status: 204, body: '' })
    })

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = `${msg.text()} @ ${msg.location().url}`
      // API status codes are asserted by the tests themselves.
      if (/Failed to load resource/.test(text) && /\/api\//.test(text)) return
      guard.consoleErrors.push(text)
    })
    page.on('pageerror', (err) => guard.consoleErrors.push(`pageerror: ${err.message}`))
    page.on('response', (res) => {
      const url = res.url()
      if (url.startsWith(origin) && !new URL(url).pathname.startsWith('/api/') && res.status() >= 400) {
        guard.badAssets.push(`${res.status()} ${url}`)
      }
    })
    page.on('requestfailed', (req) => {
      if (req.url().startsWith(origin)) guard.badAssets.push(`failed ${req.url()} (${req.failure()?.errorText})`)
    })

    await use(guard)

    const errors = guard.consoleErrors.filter((e) => !guard.allowConsole.some((re) => re.test(e)))
    expect(errors, 'console errors').toEqual([])
    expect(guard.badAssets, 'same-origin assets with 4xx/5xx').toEqual([])
    const foreign = guard.externalImages.filter((u) => !ALLOWED_IMAGE_HOSTS.some((re) => re.test(new URL(u).hostname)))
    expect(foreign, 'images from unexpected hosts').toEqual([])
  }, { auto: true }],
})

export { expect }

/** Wait for Nuxt hydration so click handlers are live. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.classList.contains('has-js'))
}
