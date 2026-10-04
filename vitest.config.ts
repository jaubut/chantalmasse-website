import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Vercel functions run in UTC; the booking math depends on the server's local
// zone, so tests pin it too (set before the forked workers start).
process.env.TZ = 'UTC'

const root = fileURLToPath(new URL('./', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
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
