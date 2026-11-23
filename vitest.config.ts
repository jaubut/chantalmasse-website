import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Cloudflare Workers run in UTC; the booking math depends on the server's local
// zone, so tests pin it too (set before the forked workers start).
process.env.TZ = 'UTC'

const root = fileURLToPath(new URL('./', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~~': root,
      '~': root,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts'],
    setupFiles: ['tests/setup/no-network.ts', 'tests/setup/nitro-globals.ts'],
    restoreMocks: true,
    testTimeout: 10_000,
  },
})
