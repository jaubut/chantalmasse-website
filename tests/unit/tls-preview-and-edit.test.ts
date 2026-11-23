/// <reference path="../../astro/src/env.d.ts" />
/// <reference path="./astro-middleware-shim.d.ts" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'

const mockWorkerEnv = vi.hoisted(() => ({} as Record<string, unknown>))

vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}))

vi.mock('cloudflare:workers', () => ({
  env: mockWorkerEnv,
}))

import { allPosts, getPost, latestPosts } from '../../astro/src/lib/blog'
import { CONTRACT_HEADER, CONTRACT_VERSION, createCmsClient, type PostDoc, type PostSummary } from '../../astro/src/lib/cms-client'
import type { Kv } from '../../astro/src/lib/page-cache'
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
import { headersFor, onRequest } from '../../astro/src/middleware'
import { GET as previewGet, POST as previewPost } from '../../astro/src/pages/_tls/preview'
import * as useBookingMod from '../../astro/src/vue/composables/useBooking'
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
    if (spec.endsWith('useBooking')) return useBookingMod
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
const NewsletterSection = loadVueSfc('../../astro/src/vue/components/NewsletterSection.vue')
const TheFooter = loadVueSfc('../../astro/src/vue/components/TheFooter.vue')
const BlogIndexPage = loadVueSfc('../../astro/src/vue/pages/BlogIndexPage.vue')
const BlogPostPage = loadVueSfc('../../astro/src/vue/pages/BlogPostPage.vue')
const CoachingDeCouplePage = loadVueSfc('../../astro/src/vue/pages/CoachingDeCouplePage.vue')
const TherapieIndividuellePage = loadVueSfc('../../astro/src/vue/pages/TherapieIndividuellePage.vue')

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
    const req = new Request(
      'https://chantalmasse.com/_tls/preview?token=prv_jwt_token_1&path=%2Fblog%2Fl-amour-conscient&tls_edit=edt_hmac_token_2',
    )
    const res = await callApi(previewGet, req)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/blog/l-amour-conscient?tls_edit=edt_hmac_token_2')
    expect(res.headers.get('set-cookie')).toBe(
      '__tls_preview=prv_jwt_token_1; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure',
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')

    // Default path `/` on http:// (no Secure attribute) and without tls_edit
    const httpReq = new Request('http://localhost:4321/_tls/preview?token=prv_local_tok')
    const httpRes = await callApi(previewGet, httpReq)
    expect(httpRes.status).toBe(303)
    expect(httpRes.headers.get('location')).toBe('/')
    expect(httpRes.headers.get('set-cookie')).toBe(
      '__tls_preview=prv_local_tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600',
    )
  })

  it('POST /_tls/preview refreshes or clears __tls_preview from same-origin fetch and rejects foreign Origin', async () => {
    const refreshRes = await callApi(
      previewPost,
      new Request('https://chantalmasse.com/_tls/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://chantalmasse.com' },
        body: JSON.stringify({ token: 'renewed_preview_tok' }),
      }),
    )
    expect(refreshRes.status).toBe(200)
    expect(refreshRes.headers.get('cache-control')).toBe('no-store')
    expect(refreshRes.headers.get('set-cookie')).toBe(
      '__tls_preview=renewed_preview_tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure',
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
})
