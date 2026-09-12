export const schedules = { task: (cfg: any) => cfg }
export const logger = {
  info: (...a: any[]) => globalThis.__LOGS.push(['info', ...a]),
  warn: (...a: any[]) => globalThis.__LOGS.push(['warn', ...a]),
  error: (...a: any[]) => globalThis.__LOGS.push(['error', ...a]),
}
