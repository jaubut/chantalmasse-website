// Nitro auto-imports, provided from the real h3 so request parsing and error
// serialization behave as in production. useRuntimeConfig and $fetch are
// test doubles controlled through tests/helpers/server.ts.
import * as h3 from 'h3'
import { vi } from 'vitest'
import { runtimeConfig } from '../helpers/runtime-config'

const g = globalThis as Record<string, unknown>

for (const name of [
  'defineEventHandler', 'readBody', 'getQuery', 'createError', 'getCookie',
  'getRequestIP', 'getRequestHeader', 'setHeader',
] as const) {
  g[name] = h3[name]
}

g.useRuntimeConfig = () => runtimeConfig

// $fetch is only used for outbound calls (Resend, image proxy) → always mocked.
const $fetch = Object.assign(vi.fn(), { raw: vi.fn() })
g.$fetch = $fetch
