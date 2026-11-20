// The same smoke suite (tests/smoke) against a deployed Astro build: the preview Worker by default.
//   SMOKE_BASE_URL=https://chantalmasse-website-astro.jeremie-aubut.workers.dev bunx playwright test -c playwright.astro.config.ts
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: process.env.SMOKE_BASE_URL ?? 'https://chantalmasse-website-astro.jeremie-aubut.workers.dev' },
  webServer: undefined,
})
