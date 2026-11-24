import { defineConfig, devices } from '@playwright/test'

// Smoke suite: runs against the Astro Worker (the preview Worker by default, or SMOKE_BASE_URL),
// covering both tests/smoke and tests/smoke-astro.
const isCI = !!process.env.CI

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
    baseURL: process.env.SMOKE_BASE_URL ?? 'https://chantalmasse-website-astro.jeremie-aubut.workers.dev',
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
