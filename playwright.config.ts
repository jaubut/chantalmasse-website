import { defineConfig, devices } from '@playwright/test'

// Smoke suite: runs against the locally built Astro Worker (`scripts/serve-astro-smoke.ts`) by default,
// or against an explicit remote deployment when `SMOKE_BASE_URL` is set, covering both tests/smoke and tests/smoke-astro.
const isCI = !!process.env.CI
const smokeBaseUrl = process.env.SMOKE_BASE_URL

export default defineConfig({
  testDir: 'tests',
  testMatch: ['smoke/**/*.spec.ts', 'smoke-astro/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: smokeBaseUrl ?? 'http://127.0.0.1:8788',
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: smokeBaseUrl
    ? undefined
    : {
        command: 'bun scripts/serve-astro-smoke.ts',
        url: 'http://127.0.0.1:8788',
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
})
