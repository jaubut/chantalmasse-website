/// <reference path="../../astro/src/env.d.ts" />
/// <reference path="./astro-middleware-shim.d.ts" />
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import astroConfig from '../../astro/astro.config.mjs'

const mockWorkerEnv = vi.hoisted(() => ({} as Record<string, unknown>))

vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}))

vi.mock('cloudflare:workers', () => ({
  env: mockWorkerEnv,
}))

import { allPosts, getPost, latestPosts } from '../../astro/src/lib/blog'
import {
  CONTRACT_HEADER,
  CONTRACT_VERSION,
  createCmsClient,
  extractBlogIndexCmsData,
  extractBookingLpCmsData,
  extractHomeCmsData,
  extractServiceLandingCmsData,
  extractSiteSettings,
  getPage,
  getRequestSettings,
  getSettings,
  resolveCmsImage,
  type PageDoc,
  type PostDoc,
  type PostSummary,
  type Settings,
} from '../../astro/src/lib/cms-client'
import { SKIP_CACHE, type Kv } from '../../astro/src/lib/page-cache'
import * as tlsEditAttrs from '../../astro/src/lib/tls-edit-attrs'
import {
  applyPreviewResponseHeaders,
  buildDormantLoaderScript,
  buildPreviewSetCookie,
  pageDocId,
  pageDocIdForPath,
  parsePreviewJwtClaims,
  postDocId,
  readPreviewCookie,
  resolveBaseLayoutTls,
  serviceDocId,
  settingsDocId,
  signPreviewToken,
  tlsBlockAttrs,
  tlsBlockFieldAttrs,
  tlsBlockImageAttrs,
  tlsCollectionAttrs,
  tlsEntryFieldAttrs,
  tlsExtFieldAttrs,
  tlsFieldAttrs,
  tlsImageAttrs,
  tlsItemAttrs,
  tlsItemImageAttrs,
  tlsPageAttrs,
  tlsPostHeroImageAttrs,
  tlsSettingsFieldAttrs,
  validatePreviewPath,
  verifyPreviewToken,
} from '../../astro/src/lib/tls-edit-attrs'
import { CACHED, headersFor, onRequest } from '../../astro/src/middleware'
import { GET as previewGet, POST as previewPost } from '../../astro/src/pages/_tls/preview'
import * as useBookingMod from '../../astro/src/vue/composables/useBooking'
import * as useContactMod from '../../astro/src/vue/composables/useContact'
import * as useTrackingMod from '../../composables/useTracking'
import * as bookingServicesMod from '../../utils/bookingServices'
import * as newsletterConsentMod from '../../utils/newsletterConsent'

const callApi = (fn: (ctx: never) => Promise<Response> | Response, request: Request) =>
  Promise.resolve(fn({ request } as never))

// Compiles a `.vue` SFC in-memory using `vue/compiler-sfc` (from declared `vue`) and `typescript`
// so `vitest.config.ts` needs no extra plugin dependency.
const sfcCache = new Map<string, vue.Component>()
function loadVueSfc(relPathFromHere: string): vue.Component {
  const fullPath = resolve(dirname(fileURLToPath(import.meta.url)), relPathFromHere)
  const cached = sfcCache.get(fullPath)
  if (cached) return cached

  const source = readFileSync(fullPath, 'utf8')
  const { descriptor } = parse(source, { filename: fullPath })
  const id = 'sfc_' + Math.random().toString(36).slice(2, 10)
  const compiledScript = compileScript(descriptor, {
    id,
    inlineTemplate: true,
    templateOptions: { id, filename: fullPath, ssr: false },
  })
  const jsCode = ts.transpileModule(compiledScript.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText

  const IconStub = vue.defineComponent({
    props: { icon: String },
    setup(props, { attrs }) {
      return () => vue.h('span', { ...attrs, 'data-icon': props.icon })
    },
  })

  const customRequire = (spec: string): unknown => {
    if (spec === 'vue') return vue
    if (spec === 'vue/server-renderer') return { ssrRenderAttrs: () => '' }
    if (spec === 'ofetch') return { ofetch: vi.fn() }
    if (spec.endsWith('tls-edit-attrs')) return tlsEditAttrs
    if (spec.endsWith('newsletterConsent')) return newsletterConsentMod
    if (spec.endsWith('bookingServices')) return bookingServicesMod
    if (spec.endsWith('useBooking')) return useBookingMod
    if (spec.endsWith('useContact')) return useContactMod
    if (spec.endsWith('useTracking')) return useTrackingMod
    if (spec.endsWith('Icon.vue')) return { default: IconStub }
    if (spec.endsWith('.vue')) return { default: loadVueSfc(resolve(dirname(fullPath), spec)) }
    throw new Error(`Unexpected import in SFC test loader: ${spec}`)
  }

  const mod = { exports: {} as { default?: vue.Component } }
  const fn = new Function('exports', 'require', 'module', jsCode)
  fn(mod.exports, customRequire, mod)
  const comp = mod.exports.default!
  if (!descriptor.scriptSetup && descriptor.template) {
    const tpl = compileTemplate({ source: descriptor.template.content, filename: fullPath, id })
    const tplJs = ts.transpileModule(tpl.code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const tplMod = { exports: {} as { render?: unknown } }
    new Function('exports', 'require', 'module', tplJs)(tplMod.exports, customRequire, tplMod)
    ;(comp as Record<string, unknown>).render = tplMod.exports.render
  }
  sfcCache.set(fullPath, comp)
  return comp
}

const HeroSection = loadVueSfc('../../astro/src/vue/components/HeroSection.vue')
const ServicesSection = loadVueSfc('../../astro/src/vue/components/ServicesSection.vue')
const PhilosophySection = loadVueSfc('../../astro/src/vue/components/PhilosophySection.vue')
const MethodsSection = loadVueSfc('../../astro/src/vue/components/MethodsSection.vue')
const TestimonialsSection = loadVueSfc('../../astro/src/vue/components/TestimonialsSection.vue')
const NewsletterSection = loadVueSfc('../../astro/src/vue/components/NewsletterSection.vue')
const BookingSection = loadVueSfc('../../astro/src/vue/components/BookingSection.vue')
const TheFooter = loadVueSfc('../../astro/src/vue/components/TheFooter.vue')
const BlogIndexPage = loadVueSfc('../../astro/src/vue/pages/BlogIndexPage.vue')
const BlogPostPage = loadVueSfc('../../astro/src/vue/pages/BlogPostPage.vue')
const CoachingDeCouplePage = loadVueSfc('../../astro/src/vue/pages/CoachingDeCouplePage.vue')
const TherapieIndividuellePage = loadVueSfc('../../astro/src/vue/pages/TherapieIndividuellePage.vue')
const PrendreRendezVousPage = loadVueSfc('../../astro/src/vue/pages/PrendreRendezVousPage.vue')

const TEST_PREVIEW_SECRET = 'test-preview-secret-32-bytes-long!!'

const SAMPLE_POST_SUMMARIES: PostSummary[] = [
  {
    id: 'chantal-masse:post:l-amour-conscient',
    locale: 'fr',
    fallbackFrom: null,
    path: '/blog/l-amour-conscient',
    title: "L'amour conscient",
    date: '2025-10-15T00:00:00.000Z',
    excerpt: 'Explorer nos relations avec curiosité et bienveillance.',
    hero: {
      src: '/media/sites/chantal-masse/media/abc123.jpg',
      alt: "L'amour conscient",
      width: 1200,
      height: 630,
      focal: null,
    },
    readingMinutes: 4,
    authors: [],
    categories: [{ id: 'chantal-masse:term:category:couple', kind: 'category', slug: 'couple', title: 'Couple', path: null }],
    tags: [],
  },
  {
    id: 'chantal-masse:post:comment-calmer-l-anxiete',
    locale: 'fr',
    fallbackFrom: null,
    path: '/blog/comment-calmer-l-anxiete',
    title: "Comment calmer l'anxiété",
    date: '2025-09-20T00:00:00.000Z',
    excerpt: 'Des pistes concrètes pour retrouver votre calme intérieur.',
    hero: {
      src: '/media/sites/chantal-masse/media/def456.jpg',
      alt: "Comment calmer l'anxiété",
      width: 1200,
      height: 630,
      focal: null,
    },
    readingMinutes: 3,
    authors: [],
    categories: [{ id: 'chantal-masse:term:category:anxiete', kind: 'category', slug: 'anxiete', title: 'Anxiété', path: null }],
    tags: [],
  },
]

const SAMPLE_POSTS = [
  {
    id: 'chantal-masse:post:l-amour-conscient',
    slug: 'l-amour-conscient',
    path: '/blog/l-amour-conscient',
    title: "L'amour conscient",
    date: '2025-10-15',
    readTime: 4,
    category: 'couple',
    excerpt: 'Explorer nos relations avec curiosité et bienveillance.',
    image: '/media/sites/chantal-masse/media/abc123.jpg?w=1200',
    imageFull: '/media/sites/chantal-masse/media/abc123.jpg',
  },
  {
    id: 'chantal-masse:post:comment-calmer-l-anxiete',
    slug: 'comment-calmer-l-anxiete',
    path: '/blog/comment-calmer-l-anxiete',
    title: "Comment calmer l'anxiété",
    date: '2025-09-20',
    readTime: 3,
    category: 'anxiete',
    excerpt: 'Des pistes concrètes pour retrouver votre calme intérieur.',
    image: '/media/sites/chantal-masse/media/def456.jpg?w=1200',
    imageFull: '/media/sites/chantal-masse/media/def456.jpg',
  },
]

beforeEach(() => {
  for (const k of Object.keys(mockWorkerEnv)) delete mockWorkerEnv[k]
  delete process.env.PREVIEW_SECRET
})

afterEach(() => {
  for (const k of Object.keys(mockWorkerEnv)) delete mockWorkerEnv[k]
  delete process.env.PREVIEW_SECRET
})

describe('S4b /_tls/preview handshake route & HS256 token verification', () => {
  it('registers /_tls/preview via injectRoute in astro/astro.config.mjs (since Astro ignores _-prefixed directories in src/pages/)', async () => {
    interface InjectedRoute {
      pattern: string
      entrypoint: string
      prerender?: boolean
    }
    interface AstroIntegrationLike {
      name: string
      hooks?: {
        'astro:config:setup'?: (opts: { injectRoute: (route: InjectedRoute) => void }) => void | Promise<void>
      }
    }
    const injectedRoutes: InjectedRoute[] = []
    const integrations = (astroConfig.integrations ?? []) as unknown as AstroIntegrationLike[]
    const previewIntegration = integrations.find(
      i => Boolean(i && typeof i === 'object' && !Array.isArray(i) && i.name === 'tls-preview-route'),
    )
    expect(previewIntegration).toBeDefined()
    const setupHook = previewIntegration?.hooks?.['astro:config:setup']
    expect(typeof setupHook).toBe('function')
    await setupHook!({
      injectRoute: (route: InjectedRoute) => {
        injectedRoutes.push(route)
      },
    })

    expect(injectedRoutes).toEqual([
      {
        pattern: '/_tls/preview',
        entrypoint: './src/pages/_tls/preview.ts',
        prerender: false,
      },
    ])

    const astroRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../astro')
    const previewEntrypoint = resolve(astroRoot, './src/pages/_tls/preview.ts')
    expect(existsSync(previewEntrypoint)).toBe(true)
  })

  it('refuses open-redirect paths (//evil.com, external URLs, backslashes) with 400', async () => {
    const evilPaths = [
      '//evil.com',
      '//evil.com/path',
      '///evil.com',
      '/\\evil.com',
      '/%2f/evil.com',
      '/%5cevil.com',
      'https://evil.com',
      'http://evil.com/foo',
      'javascript:alert(1)',
      'evil.com/path',
      '/path with spaces',
    ]

    for (const bad of evilPaths) {
      expect(validatePreviewPath(bad), `validatePreviewPath(${bad})`).toBeNull()
      const req = new Request(`https://chantalmasse.com/_tls/preview?token=preview_tok_123&path=${encodeURIComponent(bad)}`)
      const res = await callApi(previewGet, req)
      expect(res.status, `GET /_tls/preview path=${bad}`).toBe(400)
      expect(res.headers.get('set-cookie')).toBeNull()
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
  })

  it('refuses missing, empty, oversized (>2048), or header-injecting tokens with 400', async () => {
    const badUrls = [
      'https://chantalmasse.com/_tls/preview',
      'https://chantalmasse.com/_tls/preview?token=',
      `https://chantalmasse.com/_tls/preview?token=${'a'.repeat(2049)}`,
      'https://chantalmasse.com/_tls/preview?token=bad;Domain=evil.com',
      'https://chantalmasse.com/_tls/preview?token=bad%20space',
      'https://chantalmasse.com/_tls/preview?token=ok_tok&tls_edit=',
    ]

    for (const u of badUrls) {
      const res = await callApi(previewGet, new Request(u))
      expect(res.status, u).toBe(400)
      expect(res.headers.get('set-cookie')).toBeNull()
    }
  })

  it('cryptographically verifies HS256 preview tokens matching tls-cms when PREVIEW_SECRET is configured', async () => {
    const now = Date.now()
    const validJwt = await signPreviewToken('chantal-masse', TEST_PREVIEW_SECRET, now)
    const wrongSiteJwt = await signPreviewToken('le-brouemont', TEST_PREVIEW_SECRET, now)
    const wrongSecretJwt = await signPreviewToken('chantal-masse', 'wrong-secret-key', now)
    const expiredJwt = await signPreviewToken('chantal-masse', TEST_PREVIEW_SECRET, now - 4000 * 1000)

    expect(parsePreviewJwtClaims(validJwt, 'chantal-masse', now)).toMatchObject({
      aud: 'tls-preview',
      site: 'chantal-masse',
    })
    expect(await verifyPreviewToken(validJwt, TEST_PREVIEW_SECRET, 'chantal-masse', now)).toBe(true)
    expect(await verifyPreviewToken(wrongSiteJwt, TEST_PREVIEW_SECRET, 'chantal-masse', now)).toBe(false)
    expect(await verifyPreviewToken(wrongSecretJwt, TEST_PREVIEW_SECRET, 'chantal-masse', now)).toBe(false)
    expect(await verifyPreviewToken(expiredJwt, TEST_PREVIEW_SECRET, 'chantal-masse', now)).toBe(false)
    expect(await verifyPreviewToken('opaque_junk_token', TEST_PREVIEW_SECRET, 'chantal-masse', now)).toBe(false)

    // Fails closed when PREVIEW_SECRET is unset or blank (both for 3-part JWTs and opaque strings)
    expect(await verifyPreviewToken(validJwt, undefined, 'chantal-masse', now)).toBe(false)
    expect(await verifyPreviewToken(validJwt, null, 'chantal-masse', now)).toBe(false)
    expect(await verifyPreviewToken(validJwt, '   ', 'chantal-masse', now)).toBe(false)
    expect(await verifyPreviewToken('opaque_junk_token', undefined, 'chantal-masse', now)).toBe(false)

    // Without PREVIEW_SECRET configured, /_tls/preview GET and POST token handshakes fail closed with 503
    const unconfiguredGetRes = await callApi(
      previewGet,
      new Request(`https://chantalmasse.com/_tls/preview?token=${encodeURIComponent(validJwt)}&path=/blog`),
    )
    expect(unconfiguredGetRes.status).toBe(503)
    expect(unconfiguredGetRes.headers.get('set-cookie')).toBeNull()
    expect(await unconfiguredGetRes.json()).toEqual({ error: 'preview_not_configured' })

    const unconfiguredPostRes = await callApi(
      previewPost,
      new Request('https://chantalmasse.com/_tls/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://chantalmasse.com' },
        body: JSON.stringify({ token: validJwt }),
      }),
    )
    expect(unconfiguredPostRes.status).toBe(503)
    expect(unconfiguredPostRes.headers.get('set-cookie')).toBeNull()
    expect(await unconfiguredPostRes.json()).toEqual({ error: 'preview_not_configured' })

    // With PREVIEW_SECRET configured on the Worker, /_tls/preview refuses unsigned, expired, or wrong-site tokens
    mockWorkerEnv.PREVIEW_SECRET = TEST_PREVIEW_SECRET
    for (const badTok of ['opaque_junk_token', wrongSiteJwt, wrongSecretJwt, expiredJwt]) {
      const getRes = await callApi(
        previewGet,
        new Request(`https://chantalmasse.com/_tls/preview?token=${encodeURIComponent(badTok)}&path=/blog`),
      )
      expect(getRes.status).toBe(401)
      expect(getRes.headers.get('set-cookie')).toBeNull()

      const postRes = await callApi(
        previewPost,
        new Request('https://chantalmasse.com/_tls/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'https://chantalmasse.com' },
          body: JSON.stringify({ token: badTok }),
        }),
      )
      expect(postRes.status).toBe(401)
      expect(postRes.headers.get('set-cookie')).toBeNull()
    }

    // Valid HS256 token succeeds
    const okRes = await callApi(
      previewGet,
      new Request(`https://chantalmasse.com/_tls/preview?token=${encodeURIComponent(validJwt)}&path=/blog&tls_edit=edt_1`),
    )
    expect(okRes.status).toBe(303)
    expect(okRes.headers.get('location')).toBe('/blog?tls_edit=edt_1')
    expect(okRes.headers.get('set-cookie')).toContain(`__tls_preview=${validJwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure`)
  })

  it('sets __tls_preview cookie and 303-redirects to path preserving ?tls_edit=<editToken>', async () => {
    mockWorkerEnv.PREVIEW_SECRET = TEST_PREVIEW_SECRET
    const validJwt = await signPreviewToken('chantal-masse', TEST_PREVIEW_SECRET)
    const req = new Request(
      `https://chantalmasse.com/_tls/preview?token=${encodeURIComponent(validJwt)}&path=%2Fblog%2Fl-amour-conscient&tls_edit=edt_hmac_token_2`,
    )
    const res = await callApi(previewGet, req)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/blog/l-amour-conscient?tls_edit=edt_hmac_token_2')
    expect(res.headers.get('set-cookie')).toBe(
      `__tls_preview=${validJwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure`,
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')

    // Default path `/` on http:// (no Secure attribute) and without tls_edit
    const httpReq = new Request(`http://localhost:4321/_tls/preview?token=${encodeURIComponent(validJwt)}`)
    const httpRes = await callApi(previewGet, httpReq)
    expect(httpRes.status).toBe(303)
    expect(httpRes.headers.get('location')).toBe('/')
    expect(httpRes.headers.get('set-cookie')).toBe(
      `__tls_preview=${validJwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    )
  })

  it('POST /_tls/preview refreshes or clears __tls_preview from same-origin fetch and rejects foreign Origin', async () => {
    mockWorkerEnv.PREVIEW_SECRET = TEST_PREVIEW_SECRET
    const renewedJwt = await signPreviewToken('chantal-masse', TEST_PREVIEW_SECRET)
    const refreshRes = await callApi(
      previewPost,
      new Request('https://chantalmasse.com/_tls/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://chantalmasse.com' },
        body: JSON.stringify({ token: renewedJwt }),
      }),
    )
    expect(refreshRes.status).toBe(200)
    expect(refreshRes.headers.get('cache-control')).toBe('no-store')
    expect(refreshRes.headers.get('set-cookie')).toBe(
      `__tls_preview=${renewedJwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure`,
    )
    expect(await refreshRes.json()).toEqual({ ok: true, preview: true })

    const clearRes = await callApi(
      previewPost,
      new Request('https://chantalmasse.com/_tls/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://chantalmasse.com' },
        body: JSON.stringify({ clear: true }),
      }),
    )
    expect(clearRes.status).toBe(200)
    expect(clearRes.headers.get('cache-control')).toBe('no-store')
    expect(clearRes.headers.get('set-cookie')).toBe(
      '__tls_preview=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure',
    )
    expect(await clearRes.json()).toEqual({ ok: true, preview: false })

    const foreignRes = await callApi(
      previewPost,
      new Request('https://chantalmasse.com/_tls/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.com' },
        body: JSON.stringify({ clear: true }),
      }),
    )
    expect(foreignRes.status).toBe(403)
    expect(foreignRes.headers.get('set-cookie')).toBeNull()

    const invalidRes = await callApi(
      previewPost,
      new Request('https://chantalmasse.com/_tls/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(invalidRes.status).toBe(400)
  })
})

describe('S4b real middleware onRequest, PAGE_CACHE shielding, and blog.ts 401/403 live fallback', () => {
  function fakeKv(initial: Record<string, unknown> = {}) {
    const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]))
    const kv = {
      get: vi.fn(async (key: string) => (data.has(key) ? JSON.parse(data.get(key)!) : null)),
      put: vi.fn(async (key: string, value: string) => { data.set(key, value) }),
      delete: vi.fn(async (key: string) => { data.delete(key) }),
    }
    return { kv: kv as unknown as Kv & typeof kv, data }
  }

  it('shields PAGE_CACHE from unverified __tls_preview cookies, clears bad cookies, and only skips cache on verified HS256 tokens', async () => {
    const cachedEntry = {
      at: Date.now(),
      status: 200,
      type: 'text/html',
      cacheControl: null,
      body: '<!doctype html><html><body>cached blog</body></html>',
    }
    const { kv } = fakeKv({ 'html:v1:/blog': cachedEntry })
    mockWorkerEnv.PAGE_CACHE = kv
    mockWorkerEnv.CF_VERSION = { id: 'v1' }
    mockWorkerEnv.PREVIEW_SECRET = TEST_PREVIEW_SECRET

    // 1. Scraper sends junk cookie `Cookie: __tls_preview=x`: must NOT bypass PAGE_CACHE, must clear cookie
    const junkLocals: Record<string, unknown> = {}
    const junkNext = vi.fn(async () => new Response('fresh render', { headers: { 'content-type': 'text/html' } }))
    const junkRes = (await onRequest(
      {
        isPrerendered: false,
        url: new URL('https://chantalmasse.com/blog'),
        request: new Request('https://chantalmasse.com/blog', { headers: { cookie: '__tls_preview=x' } }),
        locals: junkLocals,
      } as never,
      junkNext,
    )) as Response

    expect(junkLocals.previewMode).toBe(false)
    expect(junkLocals.previewToken).toBeNull()
    expect(kv.get).toHaveBeenCalledTimes(1)
    expect(junkNext).not.toHaveBeenCalled()
    expect(await junkRes.text()).toContain('cached blog')
    expect(junkRes.headers.get('set-cookie')).toBe(
      '__tls_preview=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure',
    )

    // 2. Valid HS256 preview cookie: bypasses PAGE_CACHE, sets locals.previewMode = true, sets private/no-store + noindex
    const validJwt = await signPreviewToken('chantal-masse', TEST_PREVIEW_SECRET)
    const previewLocals: Record<string, unknown> = {}
    const previewNext = vi.fn(
      async () => new Response('<!doctype html><html><body>draft blog</body></html>', { headers: { 'content-type': 'text/html' } }),
    )
    const previewRes = (await onRequest(
      {
        isPrerendered: false,
        url: new URL('https://chantalmasse.com/blog'),
        request: new Request('https://chantalmasse.com/blog', { headers: { cookie: `__tls_preview=${validJwt}` } }),
        locals: previewLocals,
      } as never,
      previewNext,
    )) as Response

    expect(previewLocals.previewMode).toBe(true)
    expect(previewLocals.previewToken).toBe(validJwt)
    expect(kv.get).toHaveBeenCalledTimes(1) // still 1: not called for preview request
    expect(previewNext).toHaveBeenCalledTimes(1)
    expect(await previewRes.text()).toContain('draft blog')
    expect(previewRes.headers.get('cache-control')).toBe('private, no-store')
    expect(previewRes.headers.get('x-robots-tag')).toBe('noindex')

    // 3. When PREVIEW_SECRET is unset (even without PAGE_CACHE), middleware fails closed and clears the cookie
    delete mockWorkerEnv.PREVIEW_SECRET
    delete mockWorkerEnv.PAGE_CACHE
    const noSecretLocals: Record<string, unknown> = {}
    const noSecretRes = (await onRequest(
      {
        isPrerendered: false,
        url: new URL('https://chantalmasse.com/blog'),
        request: new Request('https://chantalmasse.com/blog', { headers: { cookie: `__tls_preview=${validJwt}` } }),
        locals: noSecretLocals,
      } as never,
      async () => new Response('<!doctype html><html><body>live blog</body></html>', { headers: { 'content-type': 'text/html' } }),
    )) as Response
    expect(noSecretLocals.previewMode).toBe(false)
    expect(noSecretLocals.previewToken).toBeNull()
    expect(noSecretRes.headers.get('set-cookie')).toBe(
      '__tls_preview=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure',
    )
    expect(noSecretRes.headers.get('cache-control')).toBeNull()
  })

  it('preserves cookie cleanup and NUXT_404_ROBOTS across 404 rewrites (and live fallback headers on 200) when CMS rejects a preview token', async () => {
    mockWorkerEnv.PREVIEW_SECRET = TEST_PREVIEW_SECRET
    const validJwt = await signPreviewToken('chantal-masse', TEST_PREVIEW_SECRET)

    // 1. Draft-only slug rejected by CMS (401/403): onPreviewRejected flips locals.previewMode = false,
    //    and Astro.rewrite('/404') returns a fresh 404 response that discarded Astro.response.headers.
    const rewrite404Locals: Record<string, unknown> = {}
    const rewrite404Res = (await onRequest(
      {
        isPrerendered: false,
        url: new URL('https://chantalmasse.com/blog/draft-only-post'),
        request: new Request('https://chantalmasse.com/blog/draft-only-post', {
          headers: { cookie: `__tls_preview=${validJwt}` },
        }),
        locals: rewrite404Locals,
      } as never,
      async () => {
        rewrite404Locals.previewMode = false
        rewrite404Locals.previewToken = null
        return new Response('<!doctype html><html><body>404</body></html>', {
          status: 404,
          headers: { 'content-type': 'text/html' },
        })
      },
    )) as Response

    expect(rewrite404Res.status).toBe(404)
    expect(rewrite404Res.headers.get('set-cookie')).toBe(
      '__tls_preview=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure',
    )
    expect(rewrite404Res.headers.get('x-robots-tag')).toBe(
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    )
    expect(rewrite404Res.headers.get('cache-control')).toBeNull()

    // 2. Published slug where CMS rejected preview token and fell back to 200 live content
    //    (Astro.response.headers already contains the Max-Age=0 Set-Cookie):
    //    must preserve live headers (not noindex/no-store) and must not duplicate Set-Cookie.
    const fallback200Locals: Record<string, unknown> = {}
    const fallback200Res = (await onRequest(
      {
        isPrerendered: false,
        url: new URL('https://chantalmasse.com/blog/l-amour-conscient'),
        request: new Request('https://chantalmasse.com/blog/l-amour-conscient', {
          headers: { cookie: `__tls_preview=${validJwt}` },
        }),
        locals: fallback200Locals,
      } as never,
      async () => {
        fallback200Locals.previewMode = false
        fallback200Locals.previewToken = null
        return new Response('<!doctype html><html><body>live post</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            'set-cookie': buildPreviewSetCookie(null, true),
          },
        })
      },
    )) as Response

    expect(fallback200Res.status).toBe(200)
    expect(fallback200Res.headers.get('set-cookie')).toBe(
      '__tls_preview=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure',
    )
    expect(fallback200Res.headers.get('x-robots-tag')).toBeNull()
    expect(fallback200Res.headers.get('cache-control')).toBeNull()
  })

  it('preserves stronger X-Robots-Tag: noindex, nofollow on /annuler even in preview mode', async () => {
    const res = await headersFor(
      new Response('<!doctype html><html><body>annuler</body></html>', { headers: { 'content-type': 'text/html' } }),
      '/annuler',
      {},
      true,
    )
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('passes stage=draft and Authorization: Preview <token> in cms-client, and blog.ts falls back to live on 401/403', async () => {
    const seenRequests: Request[] = []
    mockWorkerEnv.CMS = {
      fetch: vi.fn(async (req: Request) => {
        seenRequests.push(req)
        const u = new URL(req.url)
        const stage = u.searchParams.get('stage')
        const auth = req.headers.get('authorization')

        // Simulate tls-cms rejecting a stale preview token with 401
        if (stage === 'draft' && auth === 'Preview stale_token_401') {
          return new Response(JSON.stringify({ error: 'invalid or expired token' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
        }

        if (u.pathname.endsWith('/posts')) {
          return new Response(
            JSON.stringify({
              data: { items: SAMPLE_POST_SUMMARIES, page: 1, limit: 50, total: 2, pages: 1 },
              meta: { version: 1, tags: [] },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }

        const postDoc: PostDoc = {
          ...SAMPLE_POST_SUMMARIES[0]!,
          type: 'post',
          seo: { title: "L'amour conscient", description: null, image: null, noindex: false, canonical: null },
          body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour' }] }] },
          updatedAt: '2025-10-15T00:00:00.000Z',
        }
        return new Response(
          JSON.stringify({ data: postDoc, meta: { version: 1, tags: [] } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    }

    // 1. Stale preview token on allPosts -> catches 401, calls onPreviewRejected, retries stage=live
    let rejectedCount = 0
    const postsAfterFallback = await allPosts({
      previewToken: 'stale_token_401',
      onPreviewRejected: () => { rejectedCount++ },
    })
    expect(rejectedCount).toBe(1)
    expect(postsAfterFallback).toHaveLength(2)
    expect(new URL(seenRequests[0]!.url).searchParams.get('stage')).toBe('draft')
    expect(new URL(seenRequests[1]!.url).searchParams.get('stage')).toBe('live')

    // 2. Stale preview token on getPost -> catches 401, calls onPreviewRejected, retries stage=live
    seenRequests.length = 0
    let getPostRejected = false
    const postAfterFallback = await getPost('l-amour-conscient', {
      previewToken: 'stale_token_401',
      onPreviewRejected: () => { getPostRejected = true },
    })
    expect(getPostRejected).toBe(true)
    expect(postAfterFallback?.doc.id).toBe('chantal-masse:post:l-amour-conscient')
    expect(new URL(seenRequests[0]!.url).searchParams.get('stage')).toBe('draft')
    expect(new URL(seenRequests[1]!.url).searchParams.get('stage')).toBe('live')

    // 3. Valid preview token on latestPosts -> succeeds on stage=draft
    seenRequests.length = 0
    const draftLatest = await latestPosts(2, { previewToken: 'valid_draft_tok' })
    expect(draftLatest).toHaveLength(2)
    expect(seenRequests).toHaveLength(1)
    expect(new URL(seenRequests[0]!.url).searchParams.get('stage')).toBe('draft')
    expect(seenRequests[0]!.headers.get('authorization')).toBe('Preview valid_draft_tok')
    expect(seenRequests[0]!.headers.get(CONTRACT_HEADER)).toBe(String(CONTRACT_VERSION))
  })
})

describe('S4b zero-cost dormant inline loader (~450 B)', () => {
  function runLoaderEnv(initialUrl: string, initialStorage: Record<string, string> = {}, publicOrigin?: string) {
    const store = new Map<string, string>(Object.entries(initialStorage))
    const appendedScripts: Array<{ id: string; src: string; defer: boolean }> = []
    const listeners = new Map<string, Array<() => void>>()
    const loc = new URL(initialUrl)

    const sessionStorageMock = {
      getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: vi.fn((k: string, v: string) => { store.set(k, String(v)) }),
    }
    const historyMock = {
      state: { page: 1 },
      replaceState: vi.fn((_state: unknown, _unused: string, url: string) => {
        const next = new URL(url, loc.origin)
        loc.pathname = next.pathname
        loc.search = next.search
        loc.hash = next.hash
      }),
    }
    const documentMock = {
      head: {
        append: vi.fn((el: { id: string; src: string; defer: boolean }) => {
          appendedScripts.push(el)
        }),
      },
      getElementById: vi.fn((id: string) => appendedScripts.find(s => s.id === id) ?? null),
      createElement: vi.fn((_tag: string) => ({ id: '', src: '', defer: false })),
      addEventListener: vi.fn((evt: string, fn: () => void) => {
        const list = listeners.get(evt) ?? []
        list.push(fn)
        listeners.set(evt, list)
      }),
    }
    const windowMock: Record<string, unknown> = {}

    const code = buildDormantLoaderScript(publicOrigin)
    const runner = new Function('window', 'document', 'location', 'sessionStorage', 'history', code)
    const runScript = () => runner(windowMock, documentMock, loc, sessionStorageMock, historyMock)
    runScript()

    return {
      code,
      store,
      appendedScripts,
      listeners,
      loc,
      windowMock,
      historyMock,
      documentMock,
      runScript,
      firePageLoad: () => {
        for (const fn of listeners.get('astro:page-load') ?? []) fn()
      },
    }
  }

  it('stays compact (<750 B), guards astro:page-load listener registration, and makes 0 requests / injects 0 scripts for public visitors', () => {
    const env = runLoaderEnv('https://chantalmasse.com/blog?utm_source=google')
    expect(env.code.length).toBeGreaterThan(350)
    expect(env.code.length).toBeLessThan(750)
    expect(env.appendedScripts).toHaveLength(0)
    expect(env.historyMock.replaceState).not.toHaveBeenCalled()
    expect(env.windowMock.__tlsEditOrigin).toBeUndefined()
    expect(env.windowMock.__tlsEditL).toBe(1)
    expect(env.listeners.get('astro:page-load')).toHaveLength(1)

    env.runScript()
    expect(env.listeners.get('astro:page-load')).toHaveLength(1)

    env.firePageLoad()
    expect(env.appendedScripts).toHaveLength(0)
  })

  it('captures ?tls_edit into sessionStorage, strips it via history.replaceState, sets __tlsEditOrigin, and injects <__tlsEditOrigin>/tls-edit-v2.js once', () => {
    const env = runLoaderEnv('https://chantalmasse.com/coaching-de-couple?tls_edit=edit_tok_abc&utm_campaign=spring#approche')
    expect(env.store.get('tls_edit_v2_token')).toBe('edit_tok_abc')
    expect(env.historyMock.replaceState).toHaveBeenCalledTimes(1)
    expect(env.loc.pathname + env.loc.search + env.loc.hash).toBe('/coaching-de-couple?utm_campaign=spring#approche')
    expect(env.windowMock.__tlsEditOrigin).toBe('https://dashboard.apies.dev')
    expect(env.appendedScripts).toEqual([
      { id: 'tls-edit-v2-script', src: 'https://dashboard.apies.dev/tls-edit-v2.js', defer: true },
    ])

    env.runScript()
    env.firePageLoad()
    expect(env.listeners.get('astro:page-load')).toHaveLength(1)
    expect(env.appendedScripts).toHaveLength(1)
  })

  it('activates from existing sessionStorage tls_edit_v2_bearer on ClientRouter navigation and honours PUBLIC_TLS_EDIT_ORIGIN', () => {
    const env = runLoaderEnv(
      'https://chantalmasse.com/blog',
      { tls_edit_v2_bearer: 'bearer_opaque_xyz' },
      'https://portal.apies.dev',
    )
    expect(env.windowMock.__tlsEditOrigin).toBe('https://portal.apies.dev')
    expect(env.appendedScripts).toEqual([
      { id: 'tls-edit-v2-script', src: 'https://portal.apies.dev/tls-edit-v2.js', defer: true },
    ])
  })
})

describe('S4b contract-level data-tls-* attributes & real component renders (live vs preview)', () => {
  it('emits 0 data-tls-* attributes when previewMode is false across all helpers, layout resolution, and rendered components', async () => {
    const docId = pageDocId('home')
    const svcId = serviceDocId('coaching-de-couple')
    const pstId = postDocId('l-amour-conscient')
    const setId = settingsDocId()

    expect(tlsPageAttrs(false, docId, 'fr')).toEqual({})
    expect(tlsBlockAttrs(false, 'hero', 'hero')).toEqual({})
    expect(tlsFieldAttrs(false, `doc:${docId}/entry/title`)).toEqual({})
    expect(tlsBlockFieldAttrs(false, docId, 'hero', 'heading/0')).toEqual({})
    expect(tlsEntryFieldAttrs(false, docId, 'title')).toEqual({})
    expect(tlsExtFieldAttrs(false, pstId, 'excerpt')).toEqual({})
    expect(tlsSettingsFieldAttrs(false, setId, 'siteName')).toEqual({})
    expect(tlsImageAttrs(false, `doc:${docId}/blocks/hero/data/image`)).toEqual({})
    expect(tlsBlockImageAttrs(false, docId, 'hero', 'image')).toEqual({})
    expect(tlsPostHeroImageAttrs(false, pstId)).toEqual({})
    expect(tlsItemImageAttrs(false, svcId)).toEqual({})
    expect(tlsCollectionAttrs(false, 'service')).toEqual({})
    expect(tlsItemAttrs(false, svcId, 'service')).toEqual({})

    const liveLayout = resolveBaseLayoutTls({
      isPrerendered: false,
      locals: { previewMode: false, previewToken: null },
      cookieHeader: null,
      path: '/blog/l-amour-conscient',
    })
    expect(liveLayout.previewMode).toBe(false)
    expect(liveLayout.mainAttrs).toEqual({})

    const [liveNewsletter, liveBlogIndex, liveBlogPost, liveHero, liveServices, liveFooter, liveCouple, liveIndividuelle] = await Promise.all([
      renderToString(vue.createSSRApp({ render: () => vue.h(NewsletterSection, { posts: SAMPLE_POSTS, previewMode: false }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(BlogIndexPage, { posts: SAMPLE_POSTS, previewMode: false }) })),
      renderToString(
        vue.createSSRApp({
          render: () =>
            vue.h(BlogPostPage, {
              post: SAMPLE_POSTS[0]!,
              docId: SAMPLE_POSTS[0]!.id,
              heroSrcset: `${SAMPLE_POSTS[0]!.imageFull}?w=640 640w`,
              bodyHtml: '<p>Contenu</p>',
              relatedPosts: [SAMPLE_POSTS[1]!],
              previewMode: false,
            }),
        }),
      ),
      renderToString(vue.createSSRApp({ render: () => vue.h(HeroSection) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(ServicesSection) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(TheFooter) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(CoachingDeCouplePage) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(TherapieIndividuellePage) })),
    ])

    for (const [name, html] of [
      ['newsletter-live', liveNewsletter],
      ['blog-index-live', liveBlogIndex],
      ['blog-post-live', liveBlogPost],
      ['hero-static', liveHero],
      ['services-static', liveServices],
      ['footer-static', liveFooter],
      ['coaching-de-couple-static', liveCouple],
      ['therapie-individuelle-static', liveIndividuelle],
    ] as const) {
      expect(html, `${name} must have 0 data-tls-* attributes`).not.toContain('data-tls-')
    }
  })

  it('emits full contract-level data-tls-* paths in previewMode on real CMS-backed components (BlogPostPage, BlogIndexPage, NewsletterSection, plus CMS-bound HeroSection, ServicesSection, TheFooter)', async () => {
    const previewLayout = resolveBaseLayoutTls({
      isPrerendered: false,
      locals: { previewMode: true, previewToken: 'valid_tok' },
      pageDocId: SAMPLE_POSTS[0]!.id,
      path: '/blog/l-amour-conscient',
      locale: 'fr',
    })
    expect(previewLayout.previewMode).toBe(true)
    expect(previewLayout.mainAttrs).toEqual({
      'data-tls-page': 'chantal-masse:post:l-amour-conscient',
      'data-tls-locale': 'fr',
    })

    // Prerendered pages never emit data-tls-page even if cookieHeader were passed
    const prerenderedLayout = resolveBaseLayoutTls({
      isPrerendered: true,
      cookieHeader: '__tls_preview=tok',
      path: '/coaching-de-couple',
    })
    expect(prerenderedLayout.previewMode).toBe(false)
    expect(prerenderedLayout.mainAttrs).toEqual({})

    // SSR layout resolution never falls back to unverified cookieHeader when locals.previewToken is undefined
    const unverifiedCookieLayout = resolveBaseLayoutTls({
      isPrerendered: false,
      locals: {},
      cookieHeader: '__tls_preview=unverified_cookie_tok',
      path: '/blog',
    })
    expect(unverifiedCookieLayout.previewToken).toBeNull()
    expect(unverifiedCookieLayout.previewMode).toBe(false)
    expect(unverifiedCookieLayout.mainAttrs).toEqual({})

    const [previewNewsletter, previewBlogIndex, previewBlogPost, previewCmsHero, previewCmsServices, previewCmsFooter] = await Promise.all([
      renderToString(vue.createSSRApp({ render: () => vue.h(NewsletterSection, { posts: SAMPLE_POSTS, previewMode: true }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(BlogIndexPage, { posts: SAMPLE_POSTS, previewMode: true }) })),
      renderToString(
        vue.createSSRApp({
          render: () =>
            vue.h(BlogPostPage, {
              post: SAMPLE_POSTS[0]!,
              docId: SAMPLE_POSTS[0]!.id,
              heroSrcset: `${SAMPLE_POSTS[0]!.imageFull}?w=640 640w`,
              bodyHtml: '<p>Corps du billet</p>',
              relatedPosts: [SAMPLE_POSTS[1]!],
              previewMode: true,
            }),
        }),
      ),
      renderToString(
        vue.createSSRApp({
          render: () =>
            vue.h(HeroSection, {
              previewMode: true,
              cmsHero: {
                docId: pageDocId('home'),
                blockKey: 'hero',
                eyebrow: 'Thérapeute à Shefford',
                heading: ["Thérapeute en relation d'aide", 'Tu as de la valeur'],
                lede: 'Approche douce et consciente.',
                ctaLabel: 'Prendre rendez-vous',
                image: { src: '/images/chantal-hero.jpg', alt: 'Chantal Massé' },
              },
            }),
        }),
      ),
      renderToString(
        vue.createSSRApp({
          render: () =>
            vue.h(ServicesSection, {
              previewMode: true,
              cmsServices: {
                docId: pageDocId('home'),
                blockKey: 'services',
                title: 'Accompagnements personnalisés',
                lede: 'Chaque parcours est unique.',
                couple: {
                  id: serviceDocId('coaching-de-couple'),
                  title: 'Coaching de Couple',
                  description: 'Dialogue intentionnel Imago.',
                  durationMinutes: 90,
                },
                individual: {
                  id: serviceDocId('therapie-individuelle'),
                  title: 'Thérapie Individuelle',
                  description: 'Un espace sécurisé.',
                  durationMinutes: 60,
                },
              },
            }),
        }),
      ),
      renderToString(
        vue.createSSRApp({
          render: () =>
            vue.h(TheFooter, {
              previewMode: true,
              cmsSettings: {
                id: settingsDocId(),
                siteName: 'Chantal Massé',
                address: '245 rue Colette, Shefford, QC J2M 2B7',
              },
            }),
        }),
      ),
    ])

    // 1. Real BlogPostPage.vue component
    expect(previewBlogPost).toContain('data-tls-item="chantal-masse:post:l-amour-conscient"')
    expect(previewBlogPost).toContain('data-tls-kind="post"')
    expect(previewBlogPost).toContain('data-tls-image="doc:chantal-masse:post:l-amour-conscient/ext/heroMediaId"')
    expect(previewBlogPost).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/entry/title"')
    expect(previewBlogPost).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/ext/excerpt"')
    expect(previewBlogPost).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/ext/body"')
    expect(previewBlogPost).toContain('data-tls-collection="post"')
    expect(previewBlogPost).toContain('data-tls-item="chantal-masse:post:comment-calmer-l-anxiete"')

    // 2. Real BlogIndexPage.vue component
    expect(previewBlogIndex).toContain('data-tls-block="posts"')
    expect(previewBlogIndex).toContain('data-tls-block-type="collection"')
    expect(previewBlogIndex).toContain('data-tls-collection="post"')
    expect(previewBlogIndex).toContain('data-tls-item="chantal-masse:post:l-amour-conscient"')
    expect(previewBlogIndex).toContain('data-tls-kind="post"')
    expect(previewBlogIndex).toContain('data-tls-image="doc:chantal-masse:post:l-amour-conscient/ext/heroMediaId"')
    expect(previewBlogIndex).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/entry/title"')
    expect(previewBlogIndex).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/ext/excerpt"')

    // 3. Real NewsletterSection.vue component (home page CMS posts)
    expect(previewNewsletter).toContain('data-tls-collection="post"')
    expect(previewNewsletter).toContain('data-tls-item="chantal-masse:post:l-amour-conscient"')
    expect(previewNewsletter).toContain('data-tls-kind="post"')
    expect(previewNewsletter).toContain('data-tls-image="doc:chantal-masse:post:l-amour-conscient/ext/heroMediaId"')
    expect(previewNewsletter).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/entry/title"')

    // 4. Real HeroSection.vue, ServicesSection.vue, and TheFooter.vue when backed by CMS data
    expect(previewCmsHero).toContain('data-tls-block="hero"')
    expect(previewCmsHero).toContain('data-tls-block-type="hero"')
    expect(previewCmsHero).toContain('data-tls-field="doc:chantal-masse:page:home/blocks/hero/data/heading/0"')
    expect(previewCmsHero).toContain('data-tls-field="doc:chantal-masse:page:home/blocks/hero/data/lede"')
    expect(previewCmsHero).toContain('data-tls-image="doc:chantal-masse:page:home/blocks/hero/data/image"')

    expect(previewCmsServices).toContain('data-tls-block="services"')
    expect(previewCmsServices).toContain('data-tls-block-type="collection"')
    expect(previewCmsServices).toContain('data-tls-collection="service"')
    expect(previewCmsServices).toContain('data-tls-item="chantal-masse:item:service:coaching-de-couple"')
    expect(previewCmsServices).toContain('data-tls-item="chantal-masse:item:service:therapie-individuelle"')
    expect(previewCmsServices).toContain('data-tls-kind="service"')
    expect(previewCmsServices).toContain('data-tls-field="doc:chantal-masse:item:service:coaching-de-couple/entry/title"')
    expect(previewCmsServices).toContain('data-tls-field="doc:chantal-masse:item:service:coaching-de-couple/ext/description"')
    expect(previewCmsServices).toContain('data-tls-field="doc:chantal-masse:item:service:coaching-de-couple/ext/attrs/duration_minutes"')

    expect(previewCmsFooter).toContain('data-tls-field="doc:chantal-masse:settings:site/settings/siteName"')
    expect(previewCmsFooter).toContain('data-tls-field="doc:chantal-masse:settings:site/settings/address"')

    // 5. Item image helper & path mapping
    expect(tlsItemImageAttrs(true, serviceDocId('coaching-de-couple'))).toEqual({
      'data-tls-image': 'doc:chantal-masse:item:service:coaching-de-couple/ext/mediaId',
    })
    expect(pageDocIdForPath('/')).toBe('chantal-masse:page:home')
    expect(pageDocIdForPath('/blog')).toBe('chantal-masse:page:blog')
    expect(pageDocIdForPath('/blog/l-amour-conscient')).toBe('chantal-masse:post:l-amour-conscient')
  })

  it('fetches getPage() and getSettings() over SiteReads binding (draft + preview fallback, 404 resilience) and wires all pages, sections, and /media/<key> srcsets', async () => {
    // 1. Middleware CACHED regex covers all SSR CMS-backed pages
    for (const cachedPath of ['/', '/coaching-de-couple', '/therapie-individuelle', '/prendre-rendez-vous', '/blog', '/blog/l-amour-conscient', '/sitemap.xml']) {
      expect(CACHED.test(cachedPath), `CACHED should match ${cachedPath}`).toBe(true)
    }
    for (const uncachedPath of ['/annuler', '/api/booking/availability', '/_tls/preview', '/media/sites/chantal-masse/media/a.jpg']) {
      expect(CACHED.test(uncachedPath), `CACHED should not match ${uncachedPath}`).toBe(false)
    }

    // 2. getPage() and getSettings() over SiteReads with draft preview, 401 live fallback, and 404 null return
    const homePageDoc: PageDoc = {
      id: 'chantal-masse:page:home',
      type: 'page',
      locale: 'fr',
      fallbackFrom: null,
      path: '/',
      title: 'Accueil',
      template: 'default',
      seo: { title: 'Accueil', description: null, image: null, noindex: false, canonical: null },
      updatedAt: '2026-11-24T00:00:00.000Z',
      blocks: [
        {
          type: 'hero',
          key: 'hero',
          data: {
            eyebrow: 'Cabinet à Shefford',
            heading: ["Thérapeute en relation d'aide CMS", 'Retrouve ta valeur'],
            lede: 'Accompagnement conscient en Estrie.',
            cta: { label: 'Réserver maintenant' },
            image: {
              src: '/media/sites/chantal-masse/media/hero-sha256.jpg',
              alt: 'Portrait CMS Chantal',
              width: 1760,
              height: 2200,
              focal: null,
            },
          },
        },
        {
          type: 'collection',
          key: 'services',
          data: { kind: 'service', title: 'Nos services CMS', lede: 'Accompagnements sur mesure.' },
          groups: [],
          items: [
            {
              id: 'chantal-masse:item:service:coaching-de-couple',
              handle: 'coaching-de-couple',
              kind: 'service',
              slug: 'coaching-de-couple',
              title: 'Coaching de Couple CMS',
              description: 'Dialogue Imago en présentiel.',
              priceCents: 16500,
              image: null,
              available: true,
              tags: [],
              attrs: { duration_minutes: 90 },
              links: {},
            },
            {
              id: 'chantal-masse:item:service:therapie-individuelle',
              handle: 'therapie-individuelle',
              kind: 'service',
              slug: 'therapie-individuelle',
              title: 'Thérapie Individuelle CMS',
              description: 'Relation d’aide individuelle.',
              priceCents: 11000,
              image: null,
              available: true,
              tags: [],
              attrs: { duration_minutes: 60 },
              links: {},
            },
          ],
        },
        {
          type: 'rich_text',
          key: 'approche',
          data: {
            eyebrow: '"Citation CMS philosophie"',
            title: "L'amour conscient CMS",
            body: {
              type: 'doc',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Premier paragraphe CMS philosophie.' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Deuxième paragraphe CMS philosophie.' }] },
              ],
            },
            media: [{ key: 'sites/chantal-masse/media/portrait-44-sha.jpg', alt: 'Chantal portrait 44 CMS' }],
          },
        },
        {
          type: 'list',
          key: 'apropos',
          data: {
            title: 'Qui je suis CMS',
            intro: 'Intro parcours CMS.',
            items: [
              { _key: 'm1', title: 'Relations humaines CMS', body: 'Corps approche 1.' },
              { _key: 'm2', title: 'Imago & Couple CMS', body: 'Corps approche 2.' },
              { _key: 'm3', title: 'Neurosciences CMS', body: 'Corps approche 3.' },
            ],
          },
        },
        {
          type: 'list',
          key: 'temoignages',
          data: {
            title: 'Témoignages CMS',
            items: [
              { _key: 't1', title: 'Claire', subtitle: 'En thérapie individuelle', body: 'Super accompagnement avec Chantal.' },
            ],
          },
        },
        {
          type: 'collection',
          key: 'infolettre',
          data: { kind: 'post', title: 'Infolettre CMS', lede: 'Inscrivez-vous chaque mois.' },
          groups: [],
          items: [],
        },
        {
          type: 'cta',
          key: 'booking',
          data: { note: 'Prêt à réserver CMS?', label: 'Prendre RDV CMS' },
        },
      ],
    }

    const sampleSettings: Settings = {
      locale: 'fr',
      siteName: 'Chantal Massé CMS',
      tagline: "Thérapeute en relation d'aide",
      phone: '450-555-0199',
      email: 'chantal.gmasse@gmail.com',
      address: { street: '245 rue Colette', city: 'Shefford', region: 'QC', postalCode: 'J2M 2B7' },
      hours: [
        { label: 'Lundi — Mardi', value: '09:30 — 18:30' },
        { label: 'Vendredi — Dimanche', value: 'Fermé' },
      ],
      socials: [],
      logo: null,
      defaultOgImage: null,
      locales: [{ code: 'fr', label: 'Français', isDefault: true }],
    }

    const seenUrls: string[] = []
    mockWorkerEnv.CMS = {
      fetch: vi.fn(async (req: Request) => {
        seenUrls.push(req.url)
        const u = new URL(req.url)
        if (u.searchParams.get('stage') === 'draft' && req.headers.get('authorization') === 'Preview bad_tok') {
          return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
        }
        if (u.pathname.endsWith('/settings')) {
          return new Response(JSON.stringify({ data: sampleSettings, meta: { version: 1, tags: [] } }), { status: 200 })
        }
        if (u.pathname.endsWith('/page')) {
          if (u.searchParams.get('path') === '/') {
            return new Response(JSON.stringify({ data: homePageDoc, meta: { version: 1, tags: [] } }), { status: 200 })
          }
          return new Response(JSON.stringify({ data: null, meta: { version: 1, tags: [] } }), { status: 404 })
        }
        return new Response('not found', { status: 404 })
      }),
    }

    let rejected = 0
    const fetchedHome = await getPage('/', { previewToken: 'bad_tok', onPreviewRejected: () => { rejected++ } })
    expect(rejected).toBe(1)
    expect(fetchedHome?.id).toBe('chantal-masse:page:home')
    expect(new URL(seenUrls[0]!).searchParams.get('stage')).toBe('draft')
    expect(new URL(seenUrls[1]!).searchParams.get('stage')).toBe('live')

    const missingPage = await getPage('/coaching-de-couple')
    expect(missingPage).toBeNull()

    const fetchedSettings = await getSettings({ previewToken: 'good_tok' })
    expect(fetchedSettings?.siteName).toBe('Chantal Massé CMS')

    // 3. Extract CMS data and verify live render has CMS text + /media/<key> responsive srcsets + 0 data-tls-* attrs
    const homeCms = extractHomeCmsData(fetchedHome)
    const siteSettings = extractSiteSettings(fetchedSettings)
    expect(homeCms.hero?.image?.src).toBe('/media/sites/chantal-masse/media/hero-sha256.jpg')
    expect(homeCms.hero?.image?.srcset).toContain('/media/sites/chantal-masse/media/hero-sha256.jpg?w=640 640w')
    expect(homeCms.philosophy?.image?.src).toBe('/media/sites/chantal-masse/media/portrait-44-sha.jpg')
    expect(homeCms.philosophy?.image?.srcset).toContain('/media/sites/chantal-masse/media/portrait-44-sha.jpg?w=1280 1280w')
    expect(siteSettings?.address).toBe('245 rue Colette, Shefford, QC J2M 2B7')

    const [
      liveHeroHtml,
      liveServicesHtml,
      livePhilosophyHtml,
      liveMethodsHtml,
      liveTestimonialsHtml,
      liveNewsletterHtml,
      liveBookingHtml,
      liveFooterHtml,
    ] = await Promise.all([
      renderToString(vue.createSSRApp({ render: () => vue.h(HeroSection, { cmsHero: homeCms.hero }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(ServicesSection, { cmsServices: homeCms.services }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(PhilosophySection, { cmsPhilosophy: homeCms.philosophy }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(MethodsSection, { cmsMethods: homeCms.methods }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(TestimonialsSection, { cmsTestimonials: homeCms.testimonials }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(NewsletterSection, { posts: SAMPLE_POSTS, cmsNewsletter: homeCms.newsletter }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(BookingSection, { cmsBooking: homeCms.booking, cmsSettings: siteSettings }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(TheFooter, { cmsSettings: siteSettings }) })),
    ])

    expect(liveHeroHtml).toContain('Cabinet à Shefford')
    expect(liveHeroHtml).toContain('/media/sites/chantal-masse/media/hero-sha256.jpg?w=640 640w')
    expect(liveHeroHtml).not.toContain('data-tls-')

    expect(liveServicesHtml).toContain('Nos services CMS')
    expect(liveServicesHtml).toContain('Coaching de Couple CMS')
    expect(liveServicesHtml).not.toContain('data-tls-')

    expect(livePhilosophyHtml).toContain('L&#39;amour conscient CMS')
    expect(livePhilosophyHtml).toContain('Premier paragraphe CMS philosophie.')
    expect(livePhilosophyHtml).toContain('/media/sites/chantal-masse/media/portrait-44-sha.jpg?w=640 640w')
    expect(livePhilosophyHtml).not.toContain('data-tls-')

    expect(liveMethodsHtml).toContain('Qui je suis CMS')
    expect(liveMethodsHtml).toContain('Relations humaines CMS')
    expect(liveMethodsHtml).not.toContain('data-tls-')

    expect(liveTestimonialsHtml).toContain('Témoignages CMS')
    expect(liveTestimonialsHtml).toContain('Super accompagnement avec Chantal.')
    expect(liveTestimonialsHtml).not.toContain('data-tls-')

    expect(liveNewsletterHtml).toContain('Infolettre CMS')
    expect(liveNewsletterHtml).not.toContain('data-tls-')

    expect(liveBookingHtml).toContain('Prêt à réserver CMS?')
    expect(liveBookingHtml).toContain('09:30 — 18:30')
    expect(liveBookingHtml).not.toContain('data-tls-')

    expect(liveFooterHtml).toContain('Chantal Massé CMS')
    expect(liveFooterHtml).toContain('245 rue Colette, Shefford, QC J2M 2B7')
    expect(liveFooterHtml).not.toContain('data-tls-')

    // 4. Resilience fallback when getPage() returns null (404 / omitted fields):
    //    must render French copy & PR #57 static images (/images/chantal-hero.jpg, /images/chantal-portrait-44.jpg)
    const emptyHome = extractHomeCmsData(null)
    const emptyCouple = extractServiceLandingCmsData(null, 'coaching-de-couple')
    const emptyIndividuelle = extractServiceLandingCmsData(null, 'therapie-individuelle')
    const emptyBookingLp = extractBookingLpCmsData(null)
    const emptyBlog = extractBlogIndexCmsData(null)

    const [
      fallbackHero,
      fallbackPhilosophy,
      fallbackCouple,
      fallbackIndividuelle,
      fallbackBookingLp,
      fallbackBlogIndex,
    ] = await Promise.all([
      renderToString(vue.createSSRApp({ render: () => vue.h(HeroSection, { cmsHero: emptyHome.hero, previewMode: true }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(PhilosophySection, { cmsPhilosophy: emptyHome.philosophy, previewMode: true }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(CoachingDeCouplePage, { cmsPage: emptyCouple, previewMode: true }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(TherapieIndividuellePage, { cmsPage: emptyIndividuelle, previewMode: true }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(PrendreRendezVousPage, { cmsPage: emptyBookingLp, previewMode: true }) })),
      renderToString(vue.createSSRApp({ render: () => vue.h(BlogIndexPage, { posts: SAMPLE_POSTS, cmsHero: emptyBlog.hero, previewMode: true }) })),
    ])

    expect(fallbackHero).toContain('/images/chantal-hero.jpg')
    expect(fallbackHero).toContain('/images/hero/chantal-hero-690.webp 690w')
    expect(fallbackHero).toContain('data-tls-image="doc:chantal-masse:page:home/blocks/hero/data/image"')

    expect(fallbackPhilosophy).toContain('/images/chantal-portrait-44.jpg')
    expect(fallbackPhilosophy).toContain('L&#39;amour conscient')
    expect(fallbackPhilosophy).toContain('data-tls-image="doc:chantal-masse:page:home/blocks/approche/data/media/0"')
    expect(fallbackPhilosophy).toContain('data-tls-field="doc:chantal-masse:page:home/blocks/approche/data/title"')

    expect(fallbackCouple).toContain('Coaching de couple — Shefford, en présentiel')
    expect(fallbackCouple).toContain('160$ / séance')
    expect(fallbackCouple).toContain('data-tls-field="doc:chantal-masse:page:coaching-de-couple/blocks/hero/data/heading/0"')
    expect(fallbackCouple).toContain('data-tls-field="doc:chantal-masse:item:service:coaching-de-couple/ext/priceCents"')

    expect(fallbackIndividuelle).toContain('Thérapie individuelle — Shefford &amp; vidéoconférence')
    expect(fallbackIndividuelle).toContain('105$ / séance')
    expect(fallbackIndividuelle).toContain('data-tls-field="doc:chantal-masse:page:therapie-individuelle/blocks/hero/data/heading/0"')
    expect(fallbackIndividuelle).toContain('data-tls-field="doc:chantal-masse:item:service:therapie-individuelle/ext/priceCents"')

    expect(fallbackBookingLp).toContain('/images/chantal-hero.jpg')
    expect(fallbackBookingLp).toContain('/images/hero/chantal-hero-615.webp 615w')
    expect(fallbackBookingLp).toContain('Réserve ta séance avec Chantal, en moins de 2 minutes.')
    expect(fallbackBookingLp).toContain('data-tls-field="doc:chantal-masse:page:prendre-rendez-vous/blocks/hero/data/heading/0"')
    expect(fallbackBookingLp).toContain('data-tls-image="doc:chantal-masse:page:prendre-rendez-vous/blocks/hero/data/image"')
    expect(fallbackBookingLp).toContain('data-tls-field="doc:chantal-masse:page:prendre-rendez-vous/blocks/etapes/data/items/0/title"')
    expect(fallbackBookingLp).toContain('data-tls-field="doc:chantal-masse:page:prendre-rendez-vous/blocks/faq/data/items/0/title"')

    expect(fallbackBlogIndex).toContain('Ressources &amp; Réflexions')
    expect(fallbackBlogIndex).toContain('data-tls-field="doc:chantal-masse:page:blog/blocks/hero/data/title"')

    // 5. resolveCmsImage resolves raw key strings into /media/<key> + responsive srcset
    expect(resolveCmsImage({ key: 'sites/chantal-masse/media/abc.jpg', alt: 'Alt' })).toEqual({
      src: '/media/sites/chantal-masse/media/abc.jpg',
      alt: 'Alt',
      srcset:
        '/media/sites/chantal-masse/media/abc.jpg?w=640 640w, /media/sites/chantal-masse/media/abc.jpg?w=960 960w, /media/sites/chantal-masse/media/abc.jpg?w=1280 1280w, /media/sites/chantal-masse/media/abc.jpg?w=1920 1920w',
    })

    // 6. Middleware skips storing in PAGE_CACHE when page sets SKIP_CACHE on CMS hiccup
    const kvPut = vi.fn(async () => {})
    mockWorkerEnv.PAGE_CACHE = {
      get: vi.fn(async () => null),
      put: kvPut,
      delete: vi.fn(async () => {}),
    }
    mockWorkerEnv.CF_VERSION = { id: 'v2' }
    const hiccupRes = (await onRequest(
      {
        isPrerendered: false,
        url: new URL('https://chantalmasse.com/coaching-de-couple'),
        request: new Request('https://chantalmasse.com/coaching-de-couple'),
        locals: {},
      } as never,
      async () =>
        new Response('<!doctype html><html><body>fallback</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html', [SKIP_CACHE]: '1' },
        }),
    )) as Response
    expect(hiccupRes.status).toBe(200)
    expect(hiccupRes.headers.has(SKIP_CACHE)).toBe(false)
    expect(kvPut).not.toHaveBeenCalled()
  })

  it('supports dynamic CMS list lengths, preserves testimonial origIndex across filtering, binds blog hero vs heading blockType, and memoizes getRequestSettings on locals', async () => {
    // 1. Dynamic list lengths: 2 items (< default 6) and 7 items (> default 6, cycling icons) on CoachingDeCouplePage & PrendreRendezVousPage
    const couple7ItemsHtml = await renderToString(
      vue.createSSRApp({
        render: () =>
          vue.h(CoachingDeCouplePage, {
            previewMode: true,
            cmsPage: {
              docId: 'chantal-masse:page:coaching-de-couple',
              services: {
                title: '7 Situations CMS',
                items: Array.from({ length: 7 }, (_, i) => ({
                  title: `Douleur CMS #${i + 1}`,
                  body: `Description douleur #${i + 1}`,
                })),
              },
              apropos: {
                // Item 2 (index 2, past DEFAULT_COUPLE_TESTIMONIALS length 2) has empty body/title; item 3 (index 3) is complete
                items: [
                  { title: 'Couple 1', subtitle: 'Couple', body: 'Citation 1' },
                  { title: 'Couple 2', subtitle: 'Couple', body: 'Citation 2' },
                  { title: '', subtitle: '', body: '' },
                  { title: 'Couple 4', subtitle: 'Couple', body: 'Citation 4' },
                ],
              },
            },
          }),
      }),
    )
    expect(couple7ItemsHtml).toContain('Douleur CMS #7')
    expect(couple7ItemsHtml).toContain(
      'data-tls-field="doc:chantal-masse:page:coaching-de-couple/blocks/services/data/items/6/title"',
    )
    // In previewMode, incomplete item at index 2 is NOT filtered out, and item at index 3 keeps items/3/*
    expect(couple7ItemsHtml).toContain(
      'data-tls-field="doc:chantal-masse:page:coaching-de-couple/blocks/apropos/data/items/2/body"',
    )
    expect(couple7ItemsHtml).toContain(
      'data-tls-field="doc:chantal-masse:page:coaching-de-couple/blocks/apropos/data/items/3/title"',
    )

    // In live mode (previewMode: false), incomplete item at index 2 IS filtered out while Couple 4 still renders
    const coupleLiveFilteredHtml = await renderToString(
      vue.createSSRApp({
        render: () =>
          vue.h(CoachingDeCouplePage, {
            previewMode: false,
            cmsPage: {
              docId: 'chantal-masse:page:coaching-de-couple',
              services: {
                items: [
                  { title: 'Seule situation 1', body: 'Desc 1' },
                  { title: 'Seule situation 2', body: 'Desc 2' },
                ],
              },
              apropos: {
                items: [
                  { title: 'Couple 1', subtitle: 'Couple', body: 'Citation 1' },
                  { title: 'Couple 2', subtitle: 'Couple', body: 'Citation 2' },
                  { title: '', subtitle: '', body: '' },
                  { title: 'Couple 4', subtitle: 'Couple', body: 'Citation 4' },
                ],
              },
            },
          }),
      }),
    )
    expect(coupleLiveFilteredHtml).toContain('Seule situation 1')
    expect(coupleLiveFilteredHtml).toContain('Seule situation 2')
    expect(coupleLiveFilteredHtml).not.toContain('La distance s&#39;est installée')
    expect(coupleLiveFilteredHtml).toContain('Couple 4')

    // 2. Dynamic steps (4 items) and FAQ (2 items) on PrendreRendezVousPage
    const bookingLpDynamicHtml = await renderToString(
      vue.createSSRApp({
        render: () =>
          vue.h(PrendreRendezVousPage, {
            previewMode: true,
            cmsPage: {
              docId: 'chantal-masse:page:prendre-rendez-vous',
              etapes: {
                items: [
                  { title: 'Étape 1', body: 'B1' },
                  { title: 'Étape 2', body: 'B2' },
                  { title: 'Étape 3', body: 'B3' },
                  { title: 'Étape 4 Bonus', body: 'B4' },
                ],
              },
              faq: {
                items: [
                  { title: 'Q1 CMS?', body: 'R1 CMS' },
                  { title: 'Q2 CMS?', body: 'R2 CMS' },
                ],
              },
            },
          }),
      }),
    )
    expect(bookingLpDynamicHtml).toContain('Étape 4 Bonus')
    expect(bookingLpDynamicHtml).toContain(
      'data-tls-field="doc:chantal-masse:page:prendre-rendez-vous/blocks/etapes/data/items/3/title"',
    )
    expect(bookingLpDynamicHtml).toContain('Q2 CMS?')
    expect(bookingLpDynamicHtml).not.toContain('Quelle est ta formation?')

    // 3. BlogIndexPage: blockType "hero" binds heading/0; blockType "heading" binds title; pagePreviewMode=false suppresses page block attrs while keeping post attrs
    const blogWithHeroBlock = extractBlogIndexCmsData({
      id: 'chantal-masse:page:blog',
      type: 'page',
      locale: 'fr',
      fallbackFrom: null,
      path: '/blog',
      title: 'Blogue',
      template: 'default',
      seo: { title: 'Blogue', description: null, image: null, noindex: false, canonical: null },
      updatedAt: '2026-11-24T00:00:00.000Z',
      blocks: [
        {
          type: 'hero',
          key: 'hero',
          data: { eyebrow: 'Lectures', heading: ['Titre Hero Blogue'], lede: 'Lede Hero Blogue' },
        },
      ],
    })
    expect(blogWithHeroBlock.hero?.blockType).toBe('hero')
    const blogHeroHtml = await renderToString(
      vue.createSSRApp({
        render: () =>
          vue.h(BlogIndexPage, {
            posts: SAMPLE_POSTS,
            docId: blogWithHeroBlock.docId,
            cmsHero: blogWithHeroBlock.hero,
            previewMode: true,
          }),
      }),
    )
    expect(blogHeroHtml).toContain('data-tls-block="hero"')
    expect(blogHeroHtml).toContain('data-tls-block-type="hero"')
    expect(blogHeroHtml).toContain('data-tls-field="doc:chantal-masse:page:blog/blocks/hero/data/heading/0"')

    const blogNoPageDocHtml = await renderToString(
      vue.createSSRApp({
        render: () =>
          vue.h(BlogIndexPage, {
            posts: SAMPLE_POSTS,
            previewMode: true,
            pagePreviewMode: false,
          }),
      }),
    )
    expect(blogNoPageDocHtml).not.toContain('data-tls-block="hero"')
    expect(blogNoPageDocHtml).toContain('data-tls-collection="post"')
    expect(blogNoPageDocHtml).toContain('data-tls-item="chantal-masse:post:l-amour-conscient"')

    // 4. resolveBaseLayoutTls with pageDocId: null omits data-tls-page when getPage() returned 404
    const missingPageLayout = resolveBaseLayoutTls({
      isPrerendered: false,
      locals: { previewMode: true, previewToken: 'valid_tok' },
      pageDocId: null,
      path: '/coaching-de-couple',
    })
    expect(missingPageLayout.previewMode).toBe(true)
    expect(missingPageLayout.mainAttrs).toEqual({})

    // 5. getRequestSettings memoizes per SSR request on Astro.locals
    let settingsCalls = 0
    mockWorkerEnv.CMS = {
      fetch: vi.fn(async () => {
        settingsCalls++
        return new Response(
          JSON.stringify({
            data: {
              locale: 'fr',
              siteName: 'Chantal Massé Memo',
              tagline: null,
              phone: null,
              email: null,
              address: null,
              hours: [],
              socials: [],
              logo: null,
              defaultOgImage: null,
              locales: [],
            },
            meta: { version: 1, tags: [] },
          }),
          { status: 200 },
        )
      }),
    }
    const reqLocals: { cmsSettingsPromise?: Promise<Settings | null> } = {}
    const [s1, s2] = await Promise.all([
      getRequestSettings(reqLocals, { previewToken: 'tok_1' }),
      getRequestSettings(reqLocals, { previewToken: 'tok_1' }),
    ])
    expect(settingsCalls).toBe(1)
    expect(s1?.siteName).toBe('Chantal Massé Memo')
    expect(s2?.siteName).toBe('Chantal Massé Memo')
  })
})
