// The same smoke suite (tests/smoke) against a deployed Astro build: the preview Worker by default, plus the Astro-only
// regressions in tests/smoke-astro (behaviour the Nuxt build that CI's smoke job serves doesn't have).
//   SMOKE_BASE_URL=https://chantalmasse-website-astro.jeremie-aubut.workers.dev bunx playwright test -c playwright.astro.config.ts
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testDir: 'tests',
  testMatch: ['smoke/**/*.spec.ts', 'smoke-astro/**/*.spec.ts'],
  use: { ...base.use, baseURL: process.env.SMOKE_BASE_URL ?? 'https://chantalmasse-website-astro.jeremie-aubut.workers.dev' },
  webServer: undefined,
})
