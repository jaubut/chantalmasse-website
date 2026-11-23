// cms-client for the TLS CMS read contract v1 (jaubut/tls-dashboard-v2 cms/contract.ts, `createCmsClient`): the subset
// this site reads (posts, page), vendored as plain types so the Worker bundle doesn't carry zod. The engine validates
// what it serves (cms/read.ts parses rows against the contract on read); a contract major bump answers 426 here.
export const CONTRACT_VERSION = 1
export const CONTRACT_HEADER = 'TLS-CMS-Contract'

export interface Image { src: string, alt: string, width: number | null, height: number | null, focal: { x: number, y: number } | null }
export interface TermRef { id: string, kind: string, slug: string | null, title: string, path: string | null }
export interface AuthorRef { id: string, name: string, path: string | null, avatar: Image | null }

type Mark = { type: 'bold' } | { type: 'italic' } | { type: 'link', attrs: { href: string, newTab?: boolean } }
export type Inline = { type: 'text', text: string, marks?: Mark[] } | { type: 'hardBreak' }
export type RichNode =
  | { type: 'paragraph', content?: Inline[] }
  | { type: 'heading', attrs: { level: 2 | 3 | 4 }, content?: Inline[] }
  | { type: 'image', attrs: Image }
  | { type: 'blockquote', content: RichNode[] }
  | { type: 'bulletList' | 'orderedList', content: Array<{ type: 'listItem', content: RichNode[] }> }
export interface RichText { type: 'doc', content: RichNode[] }

export interface Seo { title: string, description: string | null, image: Image | null, noindex: boolean, canonical: string | null }
export interface PostSummary {
  id: string
  locale: string
  fallbackFrom: string | null
  path: string
  title: string
  date: string
  excerpt: string
  hero: Image | null
  readingMinutes: number | null
  authors: AuthorRef[]
  categories: TermRef[]
  tags: TermRef[]
}
export interface PostDoc extends PostSummary { type: 'post', seo: Seo, body: RichText, updatedAt: string }
export interface PostList { items: PostSummary[], page: number, limit: number, total: number, pages: number }
export interface CmsResult<T> { data: T, meta: { version: number, tags: string[] } }

export interface BlogPost {
  id: string
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

export class CmsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export interface CmsClientOptions {
  siteId: string
  /** Service binding fetch (env.CMS.fetch) or global fetch with an absolute baseUrl. */
  fetch: (req: Request) => Promise<Response>
  baseUrl?: string
  /** Preview token (signed __tls_preview cookie value); switches stage to draft and sends `Authorization: Preview <token>`. */
  previewToken?: string
}

export interface CmsClient {
  getPage: (i: { path: string, locale: string, stage?: 'draft' | 'live' }) => Promise<CmsResult<PostDoc | null>>
  listPosts: (i: { locale: string, page?: number, limit?: number, category?: string, sort?: 'date_desc' | 'date_asc' | 'title', stage?: 'draft' | 'live' }) => Promise<CmsResult<PostList>>
}

export function createCmsClient(opts: CmsClientOptions): CmsClient {
  const base = opts.baseUrl ?? 'https://cms.internal'
  const stage: 'draft' | 'live' = opts.previewToken ? 'draft' : 'live'
  async function call<T>(name: string, input: Record<string, string | number | undefined>): Promise<CmsResult<T>> {
    const qs = new URLSearchParams(Object.entries(input).flatMap(([k, v]): Array<[string, string]> => (v === undefined ? [] : [[k, String(v)]])))
    const headers: Record<string, string> = {
      accept: 'application/json',
      [CONTRACT_HEADER]: String(CONTRACT_VERSION),
    }
    if (opts.previewToken) headers.authorization = `Preview ${opts.previewToken}`
    const get = (): Promise<Response> => opts.fetch(new Request(`${base}/v2/sites/${opts.siteId}/${name}?${qs}`, {
      headers,
    }))
    // Reads are idempotent: one retry on a 5xx (a cold engine can answer 503/1102), as the dashboard's CMS proxy does.
    let res = await get()
    if (res.status >= 500) res = await get()
    // 404 = nothing at that path: { data: null } like the engine's typed client.
    if (!res.ok && res.status !== 404) throw new CmsError(res.status, `cms ${name}: HTTP ${res.status}`)
    const body = await res.json().catch(() => null) as CmsResult<T> | null
    if (!body || typeof body !== 'object' || !('data' in body)) throw new CmsError(res.status, `cms ${name}: HTTP ${res.status} (no data)`)
    return body
  }
  return {
    getPage: i => call('page', { ...i, stage: opts.previewToken ? 'draft' : (i.stage ?? stage) }),
    listPosts: i => call('posts', { ...i, stage: opts.previewToken ? 'draft' : (i.stage ?? stage) }),
  }
}
