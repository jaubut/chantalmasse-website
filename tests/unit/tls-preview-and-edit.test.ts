import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { CONTRACT_HEADER, CONTRACT_VERSION, createCmsClient } from '../../astro/src/lib/cms-client'
import {
  applyPreviewResponseHeaders,
  buildDormantLoaderScript,
  buildPreviewSetCookie,
  pageDocId,
  pageDocIdForPath,
  postDocId,
  readPreviewCookie,
  serviceDocId,
  settingsDocId,
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
} from '../../astro/src/lib/tls-edit-attrs'
import { GET as previewGet, POST as previewPost } from '../../astro/src/pages/_tls/preview'
import BookingSection from '../../astro/src/vue/components/BookingSection.vue'
import HeroSection from '../../astro/src/vue/components/HeroSection.vue'
import MethodsSection from '../../astro/src/vue/components/MethodsSection.vue'
import NewsletterSection from '../../astro/src/vue/components/NewsletterSection.vue'
import PhilosophySection from '../../astro/src/vue/components/PhilosophySection.vue'
import ServicesSection from '../../astro/src/vue/components/ServicesSection.vue'
import TestimonialsSection from '../../astro/src/vue/components/TestimonialsSection.vue'
import TheFooter from '../../astro/src/vue/components/TheFooter.vue'
import BlogIndexPage from '../../astro/src/vue/pages/BlogIndexPage.vue'
import CoachingDeCouplePage from '../../astro/src/vue/pages/CoachingDeCouplePage.vue'
import TherapieIndividuellePage from '../../astro/src/vue/pages/TherapieIndividuellePage.vue'

const callApi = (fn: (ctx: never) => Promise<Response> | Response, request: Request) =>
  Promise.resolve(fn({ request } as never))

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

async function renderHomeSections(previewMode: boolean): Promise<string> {
  const parts = await Promise.all([
    renderToString(createSSRApp({ render: () => h(HeroSection, { previewMode }) })),
    renderToString(createSSRApp({ render: () => h(ServicesSection, { previewMode }) })),
    renderToString(createSSRApp({ render: () => h(PhilosophySection, { previewMode }) })),
    renderToString(createSSRApp({ render: () => h(MethodsSection, { previewMode }) })),
    renderToString(createSSRApp({ render: () => h(TestimonialsSection, { previewMode }) })),
    renderToString(createSSRApp({ render: () => h(NewsletterSection, { posts: SAMPLE_POSTS, previewMode }) })),
    renderToString(createSSRApp({ render: () => h(BookingSection, { previewMode }) })),
    renderToString(createSSRApp({ render: () => h(TheFooter, { previewMode }) })),
  ])
  const mainAttrs = Object.entries(tlsPageAttrs(previewMode, pageDocId('home'), 'fr'))
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
  return `<main${mainAttrs}>${parts.join('\n')}</main>`
}

function renderPostHtml(previewMode: boolean): string {
  const post = SAMPLE_POSTS[0]!
  const rel = [SAMPLE_POSTS[1]!]
  const attrs = (obj: Record<string, string>) =>
    Object.entries(obj)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('')
  return [
    `<main${attrs(tlsPageAttrs(previewMode, post.id, 'fr'))}>`,
    `<article${attrs(tlsItemAttrs(previewMode, post.id, 'post'))}>`,
    `<img src="${post.image}" alt="${post.title}"${attrs(tlsPostHeroImageAttrs(previewMode, post.id))} />`,
    `<h1${attrs(tlsEntryFieldAttrs(previewMode, post.id, 'title'))}>${post.title}</h1>`,
    `<p${attrs(tlsExtFieldAttrs(previewMode, post.id, 'excerpt'))}>${post.excerpt}</p>`,
    `<div class="prose"${attrs(tlsExtFieldAttrs(previewMode, post.id, 'body'))}><p>Corps</p></div>`,
    `<div${attrs(tlsCollectionAttrs(previewMode, 'post'))}>`,
    ...rel.map(
      r =>
        `<a href="/blog/${r.slug}"${attrs(tlsItemAttrs(previewMode, r.id, 'post'))}>`
        + `<img src="${r.image}" alt="${r.title}"${attrs(tlsPostHeroImageAttrs(previewMode, r.id))} />`
        + `<h3${attrs(tlsEntryFieldAttrs(previewMode, r.id, 'title'))}>${r.title}</h3>`
        + `<p${attrs(tlsExtFieldAttrs(previewMode, r.id, 'excerpt'))}>${r.excerpt}</p>`
        + '</a>',
    ),
    '</div>',
    '</article>',
    '</main>',
  ].join('\n')
}

describe('S4b /_tls/preview handshake route', () => {
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
    // Refresh token
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

    // Clear cookie on exit
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

    // Cross-origin rejection
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

    // Invalid body rejection
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

describe('S4b preview cookie, middleware headers, and cms-client draft mode', () => {
  it('parses __tls_preview cookie and sets Cache-Control: private, no-store + X-Robots-Tag: noindex in preview mode', async () => {
    expect(readPreviewCookie(null)).toBeNull()
    expect(readPreviewCookie('other=1; __tls_preview=tok_draft_99; foo=bar')).toBe('tok_draft_99')
    expect(buildPreviewSetCookie('tok_1', true)).toBe(
      '__tls_preview=tok_1; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600; Secure',
    )

    const previewHeaders = new Headers({ 'content-type': 'text/html' })
    applyPreviewResponseHeaders(previewHeaders, true)
    expect(previewHeaders.get('cache-control')).toBe('private, no-store')
    expect(previewHeaders.get('x-robots-tag')).toBe('noindex')

    const liveHeaders = new Headers({ 'content-type': 'text/html' })
    applyPreviewResponseHeaders(liveHeaders, false)
    expect(liveHeaders.get('cache-control')).toBeNull()
    expect(liveHeaders.get('x-robots-tag')).toBeNull()
  })

  it('passes stage=draft and Authorization: Preview <token> in cms-client when previewToken is present', async () => {
    const requests: Request[] = []
    const fakeFetch = vi.fn(async (req: Request) => {
      requests.push(req)
      return new Response(
        JSON.stringify({ data: { items: [], page: 1, limit: 10, total: 0, pages: 1 }, meta: { version: 1, tags: [] } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    const liveClient = createCmsClient({ siteId: 'chantal-masse', fetch: fakeFetch })
    await liveClient.listPosts({ locale: 'fr' })
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0]!.url).searchParams.get('stage')).toBe('live')
    expect(requests[0]!.headers.get('authorization')).toBeNull()
    expect(requests[0]!.headers.get(CONTRACT_HEADER)).toBe(String(CONTRACT_VERSION))

    const previewClient = createCmsClient({
      siteId: 'chantal-masse',
      fetch: fakeFetch,
      previewToken: 'prv_token_xyz',
    })
    await previewClient.listPosts({ locale: 'fr' })
    await previewClient.getPage({ path: '/blog/l-amour-conscient', locale: 'fr' })
    expect(requests).toHaveLength(3)
    expect(new URL(requests[1]!.url).searchParams.get('stage')).toBe('draft')
    expect(requests[1]!.headers.get('authorization')).toBe('Preview prv_token_xyz')
    expect(new URL(requests[2]!.url).searchParams.get('stage')).toBe('draft')
    expect(requests[2]!.headers.get('authorization')).toBe('Preview prv_token_xyz')
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
    runner(windowMock, documentMock, loc, sessionStorageMock, historyMock)

    return {
      code,
      store,
      appendedScripts,
      listeners,
      loc,
      windowMock,
      historyMock,
      documentMock,
      firePageLoad: () => {
        for (const fn of listeners.get('astro:page-load') ?? []) fn()
      },
    }
  }

  it('stays compact (~450-650 B) and makes 0 requests / injects 0 scripts for public visitors', () => {
    const env = runLoaderEnv('https://chantalmasse.com/blog?utm_source=google')
    expect(env.code.length).toBeGreaterThan(350)
    expect(env.code.length).toBeLessThan(650)
    expect(env.appendedScripts).toHaveLength(0)
    expect(env.historyMock.replaceState).not.toHaveBeenCalled()
    expect(env.windowMock.__tlsEditOrigin).toBeUndefined()

    // Even across ClientRouter astro:page-load navigations, public visitors load nothing
    env.firePageLoad()
    expect(env.appendedScripts).toHaveLength(0)
  })

  it('captures ?tls_edit into sessionStorage, strips it via history.replaceState, sets __tlsEditOrigin, and injects /tls-edit-v2.js once', () => {
    const env = runLoaderEnv('https://chantalmasse.com/coaching-de-couple?tls_edit=edit_tok_abc&utm_campaign=spring#approche')
    expect(env.store.get('tls_edit_v2_token')).toBe('edit_tok_abc')
    expect(env.historyMock.replaceState).toHaveBeenCalledTimes(1)
    expect(env.loc.pathname + env.loc.search + env.loc.hash).toBe('/coaching-de-couple?utm_campaign=spring#approche')
    expect(env.windowMock.__tlsEditOrigin).toBe('https://dashboard.apies.dev')
    expect(env.appendedScripts).toEqual([
      { id: 'tls-edit-v2-script', src: '/tls-edit-v2.js', defer: true },
    ])

    // Firing astro:page-load does not inject a duplicate script when #tls-edit-v2-script is already present
    env.firePageLoad()
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
      { id: 'tls-edit-v2-script', src: '/tls-edit-v2.js', defer: true },
    ])
  })
})

describe('S4b contract-level data-tls-* attributes (0 in live mode, full contract paths in preview mode)', () => {
  it('emits 0 data-tls-* attributes when previewMode is false across all helpers and rendered pages, services, and posts', async () => {
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

    const [liveHome, liveIndividuelle, liveCouple, liveBlogIndex] = await Promise.all([
      renderHomeSections(false),
      renderToString(createSSRApp({ render: () => h(TherapieIndividuellePage, { previewMode: false }) })),
      renderToString(createSSRApp({ render: () => h(CoachingDeCouplePage, { previewMode: false }) })),
      renderToString(createSSRApp({ render: () => h(BlogIndexPage, { posts: SAMPLE_POSTS, previewMode: false }) })),
    ])
    const livePost = renderPostHtml(false)

    for (const [name, html] of [
      ['home', liveHome],
      ['therapie-individuelle', liveIndividuelle],
      ['coaching-de-couple', liveCouple],
      ['blog-index', liveBlogIndex],
      ['blog-post', livePost],
    ] as const) {
      expect(html, `${name} live render must have 0 data-tls-* attributes`).not.toContain('data-tls-')
    }
  })

  it('emits full contract-level data-tls-* paths in previewMode across home, services, blog index, and blog post', async () => {
    const [previewHome, previewIndividuelle, previewCouple, previewBlogIndex] = await Promise.all([
      renderHomeSections(true),
      renderToString(createSSRApp({ render: () => h(TherapieIndividuellePage, { previewMode: true }) })),
      renderToString(createSSRApp({ render: () => h(CoachingDeCouplePage, { previewMode: true }) })),
      renderToString(createSSRApp({ render: () => h(BlogIndexPage, { posts: SAMPLE_POSTS, previewMode: true }) })),
    ])
    const previewPost = renderPostHtml(true)

    // 1. Home page: <main>, blocks, block fields, block images, service collection + items, post collection + items, settings
    expect(previewHome).toContain('data-tls-page="chantal-masse:page:home"')
    expect(previewHome).toContain('data-tls-locale="fr"')
    expect(previewHome).toContain('data-tls-block="hero"')
    expect(previewHome).toContain('data-tls-block-type="hero"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:page:home/blocks/hero/data/heading/0"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:page:home/blocks/hero/data/heading/1"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:page:home/blocks/hero/data/lede"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:page:home/blocks/hero/data/cta/label"')
    expect(previewHome).toContain('data-tls-image="doc:chantal-masse:page:home/blocks/hero/data/image"')
    expect(previewHome).toContain('data-tls-block="services"')
    expect(previewHome).toContain('data-tls-block-type="collection"')
    expect(previewHome).toContain('data-tls-collection="service"')
    expect(previewHome).toContain('data-tls-item="chantal-masse:item:service:coaching-de-couple"')
    expect(previewHome).toContain('data-tls-item="chantal-masse:item:service:therapie-individuelle"')
    expect(previewHome).toContain('data-tls-kind="service"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:item:service:coaching-de-couple/entry/title"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:item:service:coaching-de-couple/ext/description"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:item:service:therapie-individuelle/entry/title"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:item:service:therapie-individuelle/ext/description"')
    expect(previewHome).toContain('data-tls-image="doc:chantal-masse:page:home/blocks/approche/data/media/0"')
    expect(previewHome).toContain('data-tls-collection="post"')
    expect(previewHome).toContain('data-tls-item="chantal-masse:post:l-amour-conscient"')
    expect(previewHome).toContain('data-tls-kind="post"')
    expect(previewHome).toContain('data-tls-image="doc:chantal-masse:post:l-amour-conscient/ext/heroMediaId"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/entry/title"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:settings:site/settings/siteName"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:settings:site/settings/address"')
    expect(previewHome).toContain('data-tls-field="doc:chantal-masse:settings:site/settings/hours"')

    // 2. Service pages: therapie-individuelle & coaching-de-couple
    expect(previewIndividuelle).toContain('data-tls-block="hero"')
    expect(previewIndividuelle).toContain('data-tls-field="doc:chantal-masse:page:therapie-individuelle/blocks/hero/data/heading/0"')
    expect(previewIndividuelle).toContain('data-tls-item="chantal-masse:item:service:therapie-individuelle"')
    expect(previewIndividuelle).toContain('data-tls-field="doc:chantal-masse:item:service:therapie-individuelle/ext/priceCents"')

    expect(previewCouple).toContain('data-tls-block="hero"')
    expect(previewCouple).toContain('data-tls-field="doc:chantal-masse:page:coaching-de-couple/blocks/hero/data/heading/0"')
    expect(previewCouple).toContain('data-tls-item="chantal-masse:item:service:coaching-de-couple"')
    expect(previewCouple).toContain('data-tls-field="doc:chantal-masse:item:service:coaching-de-couple/ext/priceCents"')

    // 3. Blog index page
    expect(previewBlogIndex).toContain('data-tls-block="hero"')
    expect(previewBlogIndex).toContain('data-tls-block-type="heading"')
    expect(previewBlogIndex).toContain('data-tls-field="doc:chantal-masse:page:blog/blocks/hero/data/title"')
    expect(previewBlogIndex).toContain('data-tls-block="posts"')
    expect(previewBlogIndex).toContain('data-tls-block-type="collection"')
    expect(previewBlogIndex).toContain('data-tls-collection="post"')
    expect(previewBlogIndex).toContain('data-tls-item="chantal-masse:post:l-amour-conscient"')
    expect(previewBlogIndex).toContain('data-tls-kind="post"')
    expect(previewBlogIndex).toContain('data-tls-image="doc:chantal-masse:post:l-amour-conscient/ext/heroMediaId"')
    expect(previewBlogIndex).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/entry/title"')
    expect(previewBlogIndex).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/ext/excerpt"')

    // 4. Blog post page
    expect(previewPost).toContain('data-tls-page="chantal-masse:post:l-amour-conscient"')
    expect(previewPost).toContain('data-tls-locale="fr"')
    expect(previewPost).toContain('data-tls-image="doc:chantal-masse:post:l-amour-conscient/ext/heroMediaId"')
    expect(previewPost).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/entry/title"')
    expect(previewPost).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/ext/excerpt"')
    expect(previewPost).toContain('data-tls-field="doc:chantal-masse:post:l-amour-conscient/ext/body"')
    expect(previewPost).toContain('data-tls-collection="post"')
    expect(previewPost).toContain('data-tls-item="chantal-masse:post:comment-calmer-l-anxiete"')

    // 5. Item image helper & path mapping
    expect(tlsItemImageAttrs(true, serviceDocId('coaching-de-couple'))).toEqual({
      'data-tls-image': 'doc:chantal-masse:item:service:coaching-de-couple/ext/mediaId',
    })
    expect(pageDocIdForPath('/')).toBe('chantal-masse:page:home')
    expect(pageDocIdForPath('/blog')).toBe('chantal-masse:page:blog')
    expect(pageDocIdForPath('/blog/l-amour-conscient')).toBe('chantal-masse:post:l-amour-conscient')
    expect(pageDocIdForPath('/coaching-de-couple')).toBe('chantal-masse:page:coaching-de-couple')

    // 6. Base.astro and [slug].astro wire the loader and helpers
    const baseSource = readFileSync(
      fileURLToPath(new URL('../../astro/src/layouts/Base.astro', import.meta.url)),
      'utf8',
    )
    expect(baseSource).toContain('buildDormantLoaderScript')
    expect(baseSource).toContain('tlsPageAttrs')
  })
})
