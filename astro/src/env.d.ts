/// <reference path="../.astro/types.d.ts" />
// Minimal types for the Workers runtime module the site imports (only `env`); every use narrows it to its own bindings.
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>
}

declare namespace App {
  interface Locals {
    previewToken?: string | null
    previewMode?: boolean
    cmsSettingsPromise?: Promise<import('./lib/cms-client').Settings | null>
    cfContext?: { waitUntil(p: Promise<unknown>): void }
  }
}
