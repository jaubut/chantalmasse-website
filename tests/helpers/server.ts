import { createApp, createError, setResponseStatus, toWebHandler, type EventHandler } from 'h3'
import { vi, type Mock } from 'vitest'

export { setRuntimeConfig, runtimeConfig } from './runtime-config'

export interface CallOptions {
  method?: 'GET' | 'POST'
  query?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
}

export interface CallResult {
  status: number
  json: Record<string, any>
  headers: Headers
  raw: Response
}

/** Run a Nitro event handler through a real h3 app and return the HTTP result. */
export async function callHandler(handler: EventHandler, opts: CallOptions = {}): Promise<CallResult> {
  // Serialize errors like Nitro's JSON error handler (h3 alone drops `message`).
  const app = createApp({
    onError(error, event) {
      const e = createError(error)
      setResponseStatus(event, e.statusCode)
      event.node.res.setHeader('content-type', 'application/json')
      event.node.res.end(JSON.stringify({ statusCode: e.statusCode, statusMessage: e.statusMessage, message: e.message }))
    },
  })
  app.use(handler)
  const web = toWebHandler(app)
  const url = new URL('http://localhost/test')
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST')
  const res = await web(new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }))
  const text = await res.clone().text()
  let json: Record<string, any> = {}
  try { json = text ? JSON.parse(text) : {} } catch { json = { text } }
  return { status: res.status, json, headers: res.headers, raw: res }
}

type FetchMock = Mock & { raw: Mock }

/** The global $fetch double installed by tests/setup/nitro-globals.ts. */
export function fetchMock(): FetchMock {
  return (globalThis as unknown as { $fetch: FetchMock }).$fetch
}

/** Import a handler module fresh (module-level caches are reset). */
export async function loadHandler(path: string): Promise<EventHandler> {
  vi.resetModules()
  const mod = await import(/* @vite-ignore */ path)
  return mod.default as EventHandler
}

/** Freeze Date only (timers/promises stay real so h3 keeps working). */
export function freezeNow(iso: string): void {
  vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] })
}

/** h3 serializes createError({ message }) and ({ statusMessage }) differently. */
export function errorMessage(res: CallResult): string | undefined {
  return res.json.message || res.json.statusMessage
}
