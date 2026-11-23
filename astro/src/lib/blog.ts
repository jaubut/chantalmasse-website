// The blog, read from the TLS CMS at request time (site `chantal-masse`): a post Chantal publishes in the portal is live
// on the next request, no rebuild. Posts are mapped to the fields the Nuxt Content pages used, so the components keep
// their props. Locally, without the CMS service binding, CMS_BASE_URL points at a public-reads engine (staging).
// Draft safety: `tls-cms` `SiteReads` (`cms/worker/src/index.ts` `readHandler` -> `hasPreview` in `cms/worker/src/auth.ts`)
// verifies `Authorization: Preview <token>` against `PREVIEW_SECRET` (`aud: "tls-preview"`, `site: "chantal-masse"`) on
// every `stage=draft` call over the service binding and answers 401 on an invalid or expired token. When a 401/403 occurs,
// `withLiveFallback` transparently falls back to `stage=live` and invokes `onPreviewRejected` so the caller clears the cookie.
import { env } from 'cloudflare:workers'
import { CmsError, createCmsClient, type BlogPost, type CmsClient, type PostDoc, type PostSummary } from './cms-client'

export type { BlogPost }
export const SITE_ID = 'chantal-masse'
const LOCALE = 'fr'

interface CmsEnv { CMS?: { fetch: (req: Request) => Promise<Response> }, CMS_BASE_URL?: string }

export interface BlogReadOpts {
  previewToken?: string | null
  /** Called when `tls-cms` rejects `previewToken` with 401/403 and the read falls back to `stage=live`. */
  onPreviewRejected?: () => void
}

let liveClient: CmsClient | undefined
let lastCmsBinding: unknown
let lastCmsBaseUrl: string | undefined

function cms(previewToken?: string | null): CmsClient {
  const e = env as unknown as CmsEnv
  const token = previewToken || undefined
  if (!token && liveClient && lastCmsBinding === e.CMS && lastCmsBaseUrl === e.CMS_BASE_URL) {
    return liveClient
  }
  let c: CmsClient
  if (e.CMS) c = createCmsClient({ siteId: SITE_ID, fetch: req => e.CMS!.fetch(req), previewToken: token })
  else if (e.CMS_BASE_URL) c = createCmsClient({ siteId: SITE_ID, fetch: req => fetch(req), baseUrl: e.CMS_BASE_URL, previewToken: token })
  else throw new Error('No CMS: bind CMS (service binding to tls-cms SiteReads) or set CMS_BASE_URL')
  if (!token) {
    liveClient = c
    lastCmsBinding = e.CMS
    lastCmsBaseUrl = e.CMS_BASE_URL
  }
  return c
}

async function withLiveFallback<T>(
  opts: BlogReadOpts | undefined,
  run: (client: CmsClient) => Promise<T>,
): Promise<T> {
  const token = opts?.previewToken
  if (!token) return run(cms(null))
  try {
    return await run(cms(token))
  } catch (err) {
    if (err instanceof CmsError && (err.status === 401 || err.status === 403)) {
      opts?.onPreviewRejected?.()
      return run(cms(null))
    }
    throw err
  }
}

export function toPost(p: PostSummary): BlogPost {
  return {
    id: p.id,
    slug: p.path.replace(/^\/blog\//, ''),
    path: p.path,
    title: p.title,
    date: p.date.slice(0, 10),
    readTime: p.readingMinutes,
    category: p.categories[0]?.slug ?? '',
    excerpt: p.excerpt,
    // /media/<key> (src/pages/media/[...key].ts). Pages show it at most ~1200 px wide: the engine resizes and picks
    // AVIF/WebP from Accept, like the Wix/Unsplash URLs the Nuxt posts used (w_940 enc_avif, w=1200).
    image: p.hero ? `${p.hero.src}?w=1200` : '',
    imageFull: p.hero?.src ?? '',
  }
}

/** Every published post (or draft post in preview mode), newest first (24 today; the contract pages by 50). */
export async function allPosts(opts?: BlogReadOpts): Promise<BlogPost[]> {
  return withLiveFallback(opts, async (client) => {
    const out: PostSummary[] = []
    for (let page = 1; ; page++) {
      const { data } = await client.listPosts({ locale: LOCALE, page, limit: 50, sort: 'date_desc' })
      out.push(...data.items)
      if (page >= data.pages) break
    }
    return out.map(toPost)
  })
}

export async function latestPosts(n: number, opts?: BlogReadOpts): Promise<BlogPost[]> {
  return withLiveFallback(opts, async (client) => {
    const { data } = await client.listPosts({ locale: LOCALE, limit: n, sort: 'date_desc' })
    return data.items.map(toPost)
  })
}

export async function getPost(slug: string, opts?: BlogReadOpts): Promise<{ post: BlogPost, doc: PostDoc } | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  return withLiveFallback(opts, async (client) => {
    const { data } = await client.getPage({ path: `/blog/${slug}`, locale: LOCALE })
    if (!data || data.type !== 'post') return null
    return { post: toPost(data), doc: data }
  })
}

/** "À lire aussi": up to 3 from the same category, filled from the others (same rule as the Nuxt page). */
export function related(post: BlogPost, all: BlogPost[]): BlogPost[] {
  const others = all.filter(p => p.slug !== post.slug).sort((a, b) => a.slug.localeCompare(b.slug))
  const same = others.filter(p => p.category === post.category).slice(0, 3)
  return same.length >= 3 ? same : [...same, ...others.filter(p => p.category !== post.category).slice(0, 3 - same.length)]
}
