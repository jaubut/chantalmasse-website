// Shared doubles for the trigger.dev tasks: the SDK's schedules.task() just
// returns its definition so tests can call `run` directly, and googleapis
// returns an in-memory calendar.
import { vi, type Mock } from 'vitest'

export interface FakeCalendar {
  events: { list: Mock; patch: Mock; insert: Mock; delete: Mock }
}

export function makeCalendar(): FakeCalendar {
  return { events: { list: vi.fn(), patch: vi.fn().mockResolvedValue({}), insert: vi.fn(), delete: vi.fn() } }
}

export const triggerSdkMock = () => ({
  schedules: { task: <T>(def: T) => def },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
})

/** `current` is read on every google.calendar() call: vi.mock factories are cached across resetModules. */
export function googleapisMock(current: () => FakeCalendar) {
  return {
    google: {
      auth: { JWT: class { constructor(public opts: unknown) {} } },
      calendar: () => current(),
    },
  }
}

/** Route global fetch by URL prefix; anything else still fails as "network disabled". */
export function routeFetch(routes: Record<string, (init: RequestInit) => Response | Promise<Response>>): Mock {
  const fn = vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input)
    const hit = Object.keys(routes).find((prefix) => url.startsWith(prefix))
    if (!hit) throw new Error(`network disabled in tests: ${url}`)
    return routes[hit]!(init)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
