// @ts-check
// Astro build of chantalmasse.com, next to the Nuxt app until cutover (docs/astro-migration-plan.md).
// Reuses the repo's server/, utils/, public/, assets/ and content/ as they are: Trigger.dev tasks keep importing
// server/utils and utils, and public/_redirects stays the only redirect source (Workers assets apply it first).
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, fontProviders } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

const repo = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))

export default defineConfig({
  site: 'https://chantalmasse.com',
  // Pages are prerendered; /annuler, /api/*, the blog (read from the TLS CMS at request time) and the sitemap render on the Worker.
  output: 'static',
  // /journey.html, not /journey/index.html: Workers assets then serve /journey as the page (same URL shape as Nuxt today).
  build: { format: 'file' },
  trailingSlash: 'never',
  publicDir: repo('public'),
  // No Astro.session: skip the auto-provisioned SESSION KV namespace. No <Image>: no IMAGES binding.
  session: false,
  adapter: cloudflare({ imageService: 'passthrough', prerenderEnvironment: 'node' }),
  integrations: [
    vue(),
    {
      // The static /confirmer-inscription keeps Nuxt's `X-Robots-Tag: noindex, nofollow` (routeRules robots:false).
      name: 'robots-headers',
      hooks: {
        'astro:build:done': ({ dir }) => appendFileSync(new URL('_headers', dir), '\n/confirmer-inscription\n  X-Robots-Tag: noindex, nofollow\n'),
      },
    },
  ],
  // Self-hosted like @nuxtjs/google-fonts did (same families, weights and display).
  fonts: [
    { provider: fontProviders.google(), name: 'Newsreader', cssVariable: '--font-newsreader', weights: [400, 600, 700], styles: ['normal', 'italic'], display: 'swap' },
    { provider: fontProviders.google(), name: 'Manrope', cssVariable: '--font-manrope', weights: [300, 400, 600], styles: ['normal'], display: 'swap' },
  ],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': repo(''),
        // Node-only SDKs, shimmed as on the Nuxt Worker (nitro.alias in nuxt.config.ts).
        googleapis: repo('server/shims/googleapis-calendar.ts'),
        twilio: repo('server/shims/twilio.ts'),
        '@react-email/render': repo('server/shims/empty.ts'),
      },
    },
    server: { fs: { allow: [repo('')] } },
  },
})
