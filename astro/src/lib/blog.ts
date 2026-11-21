// The blog, read from the TLS CMS at request time (site `chantal-masse`): a post Chantal publishes in the portal is live
// on the next request, no rebuild. Posts are mapped to the fields the Nuxt Content pages used, so the components keep
// their props. Locally, without the CMS service binding, CMS_BASE_URL points at a public-reads engine (staging).
import { env } from 'cloudflare:workers'
import { createCmsClient, type CmsClient, type PostDoc, type PostSummary } from './cms-client'

export const SITE_ID = 'chantal-masse'
const LOCALE = 'fr'

interface CmsEnv { CMS?: { fetch: (req: Request) => Promise<Response> }, CMS_BASE_URL?: string }

export interface BlogPost {
  slug: string
  path: string
  title: string
  date: string
  readTime: number | null
  category: string
  excerpt: string
  image: string
  /** Original size, for og:image. */
  imageFull: string
}

let client: CmsClient | undefined
function cms(): CmsClient {
  if (client) return client
  const e = env as unknown as CmsEnv
  if (e.CMS) client = createCmsClient({ siteId: SITE_ID, fetch: req => e.CMS!.fetch(req) })
  else if (e.CMS_BASE_URL) client = createCmsClient({ siteId: SITE_ID, fetch: req => fetch(req), baseUrl: e.CMS_BASE_URL })
  else throw new Error('No CMS: bind CMS (service binding to tls-cms SiteReads) or set CMS_BASE_URL')
  return client
}

function toPost(p: PostSummary): BlogPost {
  return {
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

/** Every published post, newest first (24 today; the contract pages by 50). */
export async function allPosts(): Promise<BlogPost[]> {
  const out: PostSummary[] = []
  for (let page = 1; ; page++) {
    const { data } = await cms().listPosts({ locale: LOCALE, page, limit: 50, sort: 'date_desc' })
    out.push(...data.items)
    if (page >= data.pages) break
  }
  return out.map(toPost)
}

export async function latestPosts(n: number): Promise<BlogPost[]> {
  const { data } = await cms().listPosts({ locale: LOCALE, limit: n, sort: 'date_desc' })
  return data.items.map(toPost)
}

export async function getPost(slug: string): Promise<{ post: BlogPost, doc: PostDoc } | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  const { data } = await cms().getPage({ path: `/blog/${slug}`, locale: LOCALE })
  if (!data || data.type !== 'post') return null
  return { post: toPost(data), doc: data }
}

/** "À lire aussi": up to 3 from the same category, filled from the others (same rule as the Nuxt page). */
export function related(post: BlogPost, all: BlogPost[]): BlogPost[] {
  const others = all.filter(p => p.slug !== post.slug).sort((a, b) => a.slug.localeCompare(b.slug))
  const same = others.filter(p => p.category === post.category).slice(0, 3)
  return same.length >= 3 ? same : [...same, ...others.filter(p => p.category !== post.category).slice(0, 3 - same.length)]
}
