// The blog, read from the TLS CMS at request time (site `chantal-masse`): a post Chantal publishes in the portal is live
// on the next request, no rebuild. Posts are mapped to the fields the Nuxt Content pages used, so the components keep
// their props. Locally, without the CMS service binding, CMS_BASE_URL points at a public-reads engine (staging).
// Draft safety: `tls-cms` `SiteReads` (`cms/worker/src/index.ts` `readHandler` -> `hasPreview` in `cms/worker/src/auth.ts`)
// verifies `Authorization: Preview <token>` against `PREVIEW_SECRET` (`aud: "tls-preview"`, `site: "chantal-masse"`) on
// every `stage=draft` call over the service binding and answers 401 on an invalid or expired token. When a 401/403 occurs,
// `withLiveFallback` transparently falls back to `stage=live` and invokes `onPreviewRejected` so the caller clears the cookie.
import {
  DEFAULT_LOCALE,
  SITE_ID,
  withLiveFallback,
  type BlogPost,
  type CmsReadOpts,
  type PostDoc,
  type PostSummary,
} from './cms-client'

export { SITE_ID }
export type { BlogPost }
export type BlogReadOpts = CmsReadOpts

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
      const { data } = await client.listPosts({ locale: opts?.locale ?? DEFAULT_LOCALE, page, limit: 50, sort: 'date_desc' })
      out.push(...data.items)
      if (page >= data.pages) break
    }
    return out.map(toPost)
  })
}

export async function latestPosts(n: number, opts?: BlogReadOpts): Promise<BlogPost[]> {
  return withLiveFallback(opts, async (client) => {
    const { data } = await client.listPosts({ locale: opts?.locale ?? DEFAULT_LOCALE, limit: n, sort: 'date_desc' })
    return data.items.map(toPost)
  })
}

export async function getPost(slug: string, opts?: BlogReadOpts): Promise<{ post: BlogPost, doc: PostDoc } | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  return withLiveFallback(opts, async (client) => {
    const { data } = await client.getPage({ path: `/blog/${slug}`, locale: opts?.locale ?? DEFAULT_LOCALE })
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
