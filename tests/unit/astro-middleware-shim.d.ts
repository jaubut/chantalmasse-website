// Nuxt's typecheck has no Astro virtual modules (.astro/types.d.ts is not generated there); the test mocks this one at runtime.
declare module 'astro:middleware' {
  export function defineMiddleware<T>(fn: T): T
}
