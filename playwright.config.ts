import { defineConfig, devices } from '@playwright/test'

// Smoke suite: runs against the real production build (node-server preset,
// `bun run build:smoke`) served by Nitro. Server and build run in UTC like
// Vercel; the browser runs in Shefford's timezone like real visitors.
// No secrets are configured, so even an un-mocked call can't reach
// Google/Resend/Brevo — the API answers 400/503.
const PORT = Number(process.env.SMOKE_PORT ?? 3100)
const isCI = !!process.env.CI

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node .output/server/index.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT), HOST: '127.0.0.1', NODE_ENV: 'production', TZ: 'UTC' },
  },
})
