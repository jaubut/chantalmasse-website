// cms-client for the TLS CMS read contract v1 (jaubut/tls-dashboard-v2 cms/contract.ts, `createCmsClient`): the subset
// this site reads (posts, page, settings), vendored as plain types so the Worker bundle doesn't carry zod. The engine
// validates what it serves (cms/read.ts parses rows against the contract on read); a contract major bump answers 426 here.
import {
  buildCmsMediaSrcset,
  cleanCmsText,
  CMS_MEDIA_WIDTHS,
  pageDocId,
  resolveCmsImage,
  serviceDocId,
  settingsDocId,
  type ResolvedCmsImage,
} from './tls-edit-attrs'

export { buildCmsMediaSrcset, cleanCmsText, CMS_MEDIA_WIDTHS, resolveCmsImage, type ResolvedCmsImage }

export const CONTRACT_VERSION = 1
export const CONTRACT_HEADER = 'TLS-CMS-Contract'
export const SITE_ID = 'chantal-masse'
export const DEFAULT_LOCALE = 'fr'

export interface Image {
  src: string
  alt: string
  width: number | null
  height: number | null
  focal: { x: number, y: number } | null
  /** Optional raw R2 media key when passed directly from a MediaRef-like object. */
  key?: string
}
export interface Link { href: string, external: boolean }
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

export interface ServiceAttrs {
  duration_minutes?: number
  price_suffix?: string
  price_from?: boolean
}

export interface Item {
  id: string
  handle: string | null
  kind: string
  slug: string | null
  title: string
  description: string
  priceCents: number | null
  image: Image | null
  available: boolean
  tags: string[]
  attrs: Record<string, unknown> & ServiceAttrs
  links: Record<string, Array<{ id: string, handle: string | null, title: string }>>
}

export interface Group {
  id: string
  handle: string | null
  title: string
  description: string | null
  image: Image | null
  items: Item[]
}

export interface HeroBlock {
  type: 'hero'
  key: string
  data: {
    eyebrow?: string
    heading: string[]
    lede?: string
    cta?: { label: string, link?: Link }
    image?: Image | { src?: string, key?: string, mediaId?: string, alt?: string }
  }
}

export interface HeadingBlock {
  type: 'heading'
  key: string
  data: {
    anchor?: string
    eyebrow?: string
    title?: string
    lede?: string
    note?: string
  }
}

export interface RichTextBlock {
  type: 'rich_text'
  key: string
  data: {
    eyebrow?: string
    title?: string
    body: RichText | string
    media?: Array<Image | { src?: string, key?: string, mediaId?: string, alt?: string }>
  }
}

export interface MediaBlock {
  type: 'media'
  key: string
  data: {
    images: Array<Image | { src?: string, key?: string, mediaId?: string, alt?: string }>
    caption?: string
    layout?: 'full' | 'grid' | 'carousel'
  }
}

export interface ListBlockItem {
  _key: string
  title: string
  subtitle?: string
  body?: string
  image?: Image | { src?: string, key?: string, mediaId?: string, alt?: string }
  link?: Link
}

export interface ListBlock {
  type: 'list'
  key: string
  data: {
    title?: string
    intro?: string
    items: ListBlockItem[]
  }
}

export interface CtaBlock {
  type: 'cta'
  key: string
  data: {
    label: string
    link?: Link
    note?: string
  }
}

export interface CollectionBlock {
  type: 'collection'
  key: string
  data: {
    kind: string
    title?: string
    lede?: string
    options?: Record<string, string>
  }
  groups: Group[]
  items: Item[]
}

export type BlockBase =
  | HeroBlock
  | HeadingBlock
  | RichTextBlock
  | MediaBlock
  | ListBlock
  | CtaBlock
  | CollectionBlock

export interface SectionRefBlock {
  type: 'section_ref'
  key: string
  sectionId: string
  blocks: BlockBase[]
}

export type Block = BlockBase | SectionRefBlock

export interface PageDoc {
  id: string
  type: 'page'
  locale: string
  fallbackFrom: string | null
  path: string
  title: string
  template: string
  seo: Seo
  alternates?: Array<{ locale: string, path: string }>
  blocks: Block[]
  updatedAt: string
}

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
export type RoutedDoc = PageDoc | PostDoc
export interface PostList { items: PostSummary[], page: number, limit: number, total: number, pages: number }

export interface Settings {
  locale: string
  siteName: string
  tagline: string | null
  phone: string | null
  email: string | null
  address: Record<string, string> | string | null
  hours: Array<{ label: string, value: string }>
  socials: Array<{ network: string, url: string }>
  logo: Image | null
  defaultOgImage: Image | null
  locales: Array<{ code: string, label: string, isDefault: boolean }>
}

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
  getPage: (i: { path: string, locale: string, stage?: 'draft' | 'live' }) => Promise<CmsResult<RoutedDoc | null>>
  listPosts: (i: { locale: string, page?: number, limit?: number, category?: string, sort?: 'date_desc' | 'date_asc' | 'title', stage?: 'draft' | 'live' }) => Promise<CmsResult<PostList>>
  getSettings: (i: { locale: string, stage?: 'draft' | 'live' }) => Promise<CmsResult<Settings | null>>
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
    if (!body || typeof body !== 'object' || !('data' in body)) {
      if (res.status === 404) return { data: null as unknown as T, meta: { version: 0, tags: [] } }
      throw new CmsError(res.status, `cms ${name}: HTTP ${res.status} (no data)`)
    }
    return body
  }
  return {
    getPage: i => call('page', { ...i, stage: opts.previewToken ? 'draft' : (i.stage ?? stage) }),
    listPosts: i => call('posts', { ...i, stage: opts.previewToken ? 'draft' : (i.stage ?? stage) }),
    getSettings: i => call('settings', { ...i, stage: opts.previewToken ? 'draft' : (i.stage ?? stage) }),
  }
}

// ---------- Worker service-binding helpers (`getPage`, `getSettings`, `withLiveFallback`) ----------

interface CmsEnv {
  CMS?: { fetch: (req: Request) => Promise<Response> }
  CMS_BASE_URL?: string
}

export interface CmsReadOpts {
  locale?: string
  previewToken?: string | null
  /** Called when `tls-cms` rejects `previewToken` with 401/403 and the read falls back to `stage=live`. */
  onPreviewRejected?: () => void
}

let liveClient: CmsClient | undefined
let lastCmsBinding: unknown
let lastCmsBaseUrl: string | undefined

export async function getCmsClient(previewToken?: string | null): Promise<CmsClient> {
  const { env } = await import('cloudflare:workers')
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

export async function withLiveFallback<T>(
  opts: CmsReadOpts | undefined,
  run: (client: CmsClient) => Promise<T>,
): Promise<T> {
  const token = opts?.previewToken
  if (!token) return run(await getCmsClient(null))
  try {
    return await run(await getCmsClient(token))
  } catch (err) {
    if (err instanceof CmsError && (err.status === 401 || err.status === 403)) {
      opts?.onPreviewRejected?.()
      return run(await getCmsClient(null))
    }
    throw err
  }
}

/**
 * Fetches a page document (`type === 'page'`) at `path` from `tls-cms` over the `CMS` (`SiteReads`) service binding.
 * Sends `stage=draft` + `Authorization: Preview <token>` when `previewToken` is present, falling back to `stage=live`
 * and invoking `onPreviewRejected` if `tls-cms` rejects the token with 401/403. Returns `null` on 404.
 */
export async function getPage(path: string, opts?: CmsReadOpts): Promise<PageDoc | null> {
  return withLiveFallback(opts, async (client) => {
    const { data } = await client.getPage({ path, locale: opts?.locale ?? DEFAULT_LOCALE })
    if (!data || data.type !== 'page') return null
    return data
  })
}

/**
 * Fetches the site settings singleton (`chantal-masse:settings:site`) from `tls-cms` over the `CMS` (`SiteReads`) binding.
 * Sends `stage=draft` + `Authorization: Preview <token>` when `previewToken` is present, falling back to `stage=live`
 * and invoking `onPreviewRejected` if `tls-cms` rejects the token with 401/403. Returns `null` on 404.
 */
export async function getSettings(opts?: CmsReadOpts): Promise<Settings | null> {
  return withLiveFallback(opts, async (client) => {
    const { data } = await client.getSettings({ locale: opts?.locale ?? DEFAULT_LOCALE })
    return data ?? null
  })
}

export interface RequestSettingsLocals {
  cmsSettingsPromise?: Promise<Settings | null>
}

/**
 * Memoizes `getSettings(opts)` per SSR request on `Astro.locals.cmsSettingsPromise` so page frontmatter and `Base.astro`
 * never issue duplicate uncached settings reads on the same request.
 */
export function getRequestSettings(
  locals: RequestSettingsLocals | undefined,
  opts?: CmsReadOpts,
): Promise<Settings | null> {
  if (!locals) return getSettings(opts)
  if (!locals.cmsSettingsPromise) {
    locals.cmsSettingsPromise = getSettings(opts)
  }
  return locals.cmsSettingsPromise
}

// ---------- RichText and Block data extraction helpers ----------

export function richTextToPlain(doc?: RichText | string | null): string[] {
  if (!doc) return []
  if (typeof doc === 'string') {
    const cleaned = cleanCmsText(doc)
    return cleaned ? [cleaned] : []
  }
  if (!Array.isArray(doc.content)) return []
  const inline = (c: Inline[] = []): string => c.map(n => (n.type === 'text' ? n.text : '\n')).join('').trim()
  return doc.content
    .flatMap(b => (b.type === 'paragraph' || b.type === 'heading' ? [cleanCmsText(inline(b.content)) ?? ''] : []))
    .filter(Boolean)
}

export function formatCmsAddress(address?: Record<string, string> | string | null): string | undefined {
  if (!address) return undefined
  if (typeof address === 'string') return address.trim() || undefined
  if (typeof address !== 'object' || Array.isArray(address)) return undefined
  for (const key of ['formatted', 'full', 'text', 'label']) {
    const val = address[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  const street = (address.street ?? address.line1 ?? address.address ?? '').trim()
  const city = (address.city ?? address.locality ?? '').trim()
  const region = (address.region ?? address.province ?? address.state ?? '').trim()
  const postal = (address.postalCode ?? address.postal_code ?? address.zip ?? '').trim()
  const tail = [region, postal].filter(Boolean).join(' ')
  const parts = [street, city, tail].filter(Boolean)
  if (parts.length > 0) return parts.join(', ')
  const fallback = Object.values(address)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(v => v.trim())
    .join(', ')
  return fallback || undefined
}

export function flattenPageBlocks(page?: PageDoc | null): BlockBase[] {
  if (!page || !Array.isArray(page.blocks)) return []
  const out: BlockBase[] = []
  for (const b of page.blocks) {
    if (!b || typeof b !== 'object') continue
    if (b.type === 'section_ref') {
      if (Array.isArray(b.blocks)) out.push(...b.blocks)
    } else {
      out.push(b)
    }
  }
  return out
}

function findBlock<T extends BlockBase['type']>(
  blocks: BlockBase[],
  key: string,
  type?: T,
): Extract<BlockBase, { type: T }> | undefined {
  return blocks.find(b => b.key === key && (!type || b.type === type)) as Extract<BlockBase, { type: T }> | undefined
}

function findServiceItem(items: Item[], handle: 'coaching-de-couple' | 'therapie-individuelle'): Item | undefined {
  return items.find(
    it =>
      it.available !== false
      && (it.handle === handle || it.slug === handle || it.id === serviceDocId(handle) || it.id.endsWith(`:${handle}`)),
  )
}

function collectServiceItems(blocks: BlockBase[]): Item[] {
  const out: Item[] = []
  for (const b of blocks) {
    if (b.type === 'collection') {
      if (Array.isArray(b.items)) out.push(...b.items)
      if (Array.isArray(b.groups)) {
        for (const g of b.groups) {
          if (Array.isArray(g.items)) out.push(...g.items)
        }
      }
    }
  }
  return out
}

export interface CmsSiteSettingsData {
  id?: string
  siteName?: string
  tagline?: string
  phone?: string
  email?: string
  address?: string
  hours?: Array<{ label: string, value: string }>
  socials?: Array<{ network: string, url: string }>
}

export function extractSiteSettings(settings?: Settings | null): CmsSiteSettingsData | undefined {
  if (!settings) return undefined
  const siteName = settings.siteName?.trim() || undefined
  const tagline = settings.tagline?.trim() || undefined
  const phone = settings.phone?.trim() || undefined
  const email = settings.email?.trim() || undefined
  const address = formatCmsAddress(settings.address)
  const hours = Array.isArray(settings.hours)
    ? settings.hours.filter(h => h && typeof h.label === 'string' && h.label.trim() && typeof h.value === 'string' && h.value.trim())
    : []
  const socials = Array.isArray(settings.socials)
    ? settings.socials.filter(s => s && typeof s.network === 'string' && s.network.trim() && typeof s.url === 'string' && s.url.trim())
    : []
  return {
    id: settingsDocId(),
    ...(siteName ? { siteName } : {}),
    ...(tagline ? { tagline } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
    ...(hours.length > 0 ? { hours } : {}),
    ...(socials.length > 0 ? { socials } : {}),
  }
}

export interface ExtractedHomeCmsData {
  docId: string
  hero?: {
    docId: string
    blockKey: string
    eyebrow?: string
    heading?: [string, string?]
    lede?: string
    ctaLabel?: string
    image?: ResolvedCmsImage
  }
  services?: {
    docId: string
    blockKey: string
    title?: string
    lede?: string
    couple?: {
      id: string
      title: string
      description: string
      durationMinutes?: number | null
      priceCents?: number | null
    }
    individual?: {
      id: string
      title: string
      description: string
      durationMinutes?: number | null
      priceCents?: number | null
    }
  }
  philosophy?: {
    docId: string
    blockKey: string
    eyebrow?: string
    title?: string
    paragraphs?: string[]
    image?: ResolvedCmsImage
  }
  methods?: {
    docId: string
    blockKey: string
    title?: string
    intro?: string
    items?: Array<{ title?: string, subtitle?: string, body?: string }>
  }
  testimonials?: {
    docId: string
    blockKey: string
    title?: string
    items?: Array<{ title?: string, subtitle?: string, body?: string }>
  }
  newsletter?: {
    docId: string
    blockKey: string
    title?: string
    lede?: string
  }
  booking?: {
    docId: string
    blockKey: string
    note?: string
    label?: string
  }
}

export function extractHomeCmsData(page?: PageDoc | null): ExtractedHomeCmsData {
  const docId = page?.id || pageDocId('home')
  const blocks = flattenPageBlocks(page)

  // 1. Hero block ('hero')
  const heroBlock = findBlock(blocks, 'hero', 'hero')
  const heroImg = resolveCmsImage(heroBlock?.data?.image)
  const h0 = cleanCmsText(heroBlock?.data?.heading?.[0])
  const h1 = cleanCmsText(heroBlock?.data?.heading?.[1])
  const heroEyebrow = cleanCmsText(heroBlock?.data?.eyebrow)
  const heroLede = cleanCmsText(heroBlock?.data?.lede)
  const heroCtaLabel = cleanCmsText(heroBlock?.data?.cta?.label)
  const heroHeading: [string, string?] | undefined = h0
    ? (h1 ? [h0, h1] : [h0])
    : (h1 ? ['', h1] : undefined)
  const hero = heroBlock
    ? {
        docId,
        blockKey: heroBlock.key,
        ...(heroEyebrow ? { eyebrow: heroEyebrow } : {}),
        ...(heroHeading ? { heading: heroHeading } : {}),
        ...(heroLede ? { lede: heroLede } : {}),
        ...(heroCtaLabel ? { ctaLabel: heroCtaLabel } : {}),
        ...(heroImg ? { image: heroImg } : {}),
      }
    : undefined

  // 2. Services block ('services')
  const servicesColl = findBlock(blocks, 'services', 'collection')
  const servicesHeading = findBlock(blocks, 'services', 'heading')
  const serviceItems = servicesColl
    ? [...(servicesColl.items ?? []), ...(servicesColl.groups ?? []).flatMap(g => g.items ?? [])]
    : collectServiceItems(blocks)
  const coupleItem = findServiceItem(serviceItems, 'coaching-de-couple')
  const individualItem = findServiceItem(serviceItems, 'therapie-individuelle')
  const svcTitle = cleanCmsText(servicesColl?.data?.title ?? servicesColl?.data?.options?.title ?? servicesHeading?.data?.title)
  const svcLede = cleanCmsText(servicesColl?.data?.lede ?? servicesColl?.data?.options?.lede ?? servicesHeading?.data?.lede)
  const services = (servicesColl || servicesHeading || coupleItem || individualItem)
    ? {
        docId,
        blockKey: servicesColl?.key ?? servicesHeading?.key ?? 'services',
        ...(svcTitle ? { title: svcTitle } : {}),
        ...(svcLede ? { lede: svcLede } : {}),
        ...(coupleItem
          ? {
              couple: {
                id: coupleItem.id || serviceDocId('coaching-de-couple'),
                title: cleanCmsText(coupleItem.title) ?? coupleItem.title,
                description: cleanCmsText(coupleItem.description) ?? coupleItem.description,
                durationMinutes: typeof coupleItem.attrs?.duration_minutes === 'number' ? coupleItem.attrs.duration_minutes : null,
                priceCents: coupleItem.priceCents,
              },
            }
          : {}),
        ...(individualItem
          ? {
              individual: {
                id: individualItem.id || serviceDocId('therapie-individuelle'),
                title: cleanCmsText(individualItem.title) ?? individualItem.title,
                description: cleanCmsText(individualItem.description) ?? individualItem.description,
                durationMinutes: typeof individualItem.attrs?.duration_minutes === 'number' ? individualItem.attrs.duration_minutes : null,
                priceCents: individualItem.priceCents,
              },
            }
          : {}),
      }
    : undefined

  // 3. Philosophy block ('approche', rich_text)
  const approcheBlock = findBlock(blocks, 'approche', 'rich_text')
  const approcheParagraphs = richTextToPlain(approcheBlock?.data?.body)
  const approcheImg = resolveCmsImage(approcheBlock?.data?.media?.[0])
  const approcheEyebrow = cleanCmsText(approcheBlock?.data?.eyebrow)
  const approcheTitle = cleanCmsText(approcheBlock?.data?.title)
  const philosophy = approcheBlock
    ? {
        docId,
        blockKey: approcheBlock.key,
        ...(approcheEyebrow ? { eyebrow: approcheEyebrow } : {}),
        ...(approcheTitle ? { title: approcheTitle } : {}),
        ...(approcheParagraphs.length > 0 ? { paragraphs: approcheParagraphs } : {}),
        ...(approcheImg ? { image: approcheImg } : {}),
      }
    : undefined

  // 4. Methods block ('apropos', list)
  const aproposBlock = findBlock(blocks, 'apropos', 'list')
  const aproposTitle = cleanCmsText(aproposBlock?.data?.title)
  const aproposIntro = cleanCmsText(aproposBlock?.data?.intro)
  const methods = aproposBlock
    ? {
        docId,
        blockKey: aproposBlock.key,
        ...(aproposTitle ? { title: aproposTitle } : {}),
        ...(aproposIntro ? { intro: aproposIntro } : {}),
        ...(Array.isArray(aproposBlock.data.items) && aproposBlock.data.items.length > 0
          ? {
              items: aproposBlock.data.items.map((it) => {
                const t = cleanCmsText(it.title)
                const s = cleanCmsText(it.subtitle)
                const b = cleanCmsText(it.body)
                return {
                  ...(t ? { title: t } : {}),
                  ...(s ? { subtitle: s } : {}),
                  ...(b ? { body: b } : {}),
                }
              }),
            }
          : {}),
      }
    : undefined

  // 5. Testimonials block ('temoignages', list)
  const temoignagesBlock = findBlock(blocks, 'temoignages', 'list')
  const temoignagesTitle = cleanCmsText(temoignagesBlock?.data?.title)
  const testimonials = temoignagesBlock
    ? {
        docId,
        blockKey: temoignagesBlock.key,
        ...(temoignagesTitle ? { title: temoignagesTitle } : {}),
        ...(Array.isArray(temoignagesBlock.data.items) && temoignagesBlock.data.items.length > 0
          ? {
              items: temoignagesBlock.data.items.map((it) => {
                const t = cleanCmsText(it.title)
                const s = cleanCmsText(it.subtitle)
                const b = cleanCmsText(it.body)
                return {
                  ...(t ? { title: t } : {}),
                  ...(s ? { subtitle: s } : {}),
                  ...(b ? { body: b } : {}),
                }
              }),
            }
          : {}),
      }
    : undefined

  // 6. Newsletter block ('infolettre', collection or heading)
  const infoColl = findBlock(blocks, 'infolettre', 'collection')
  const infoHeading = findBlock(blocks, 'infolettre', 'heading')
  const infoTitle = cleanCmsText(infoColl?.data?.title ?? infoColl?.data?.options?.title ?? infoHeading?.data?.title)
  const infoLede = cleanCmsText(infoColl?.data?.lede ?? infoColl?.data?.options?.lede ?? infoHeading?.data?.lede)
  const newsletter = (infoColl || infoHeading)
    ? {
        docId,
        blockKey: infoColl?.key ?? infoHeading?.key ?? 'infolettre',
        ...(infoTitle ? { title: infoTitle } : {}),
        ...(infoLede ? { lede: infoLede } : {}),
      }
    : undefined

  // 7. Booking block ('booking', cta)
  const bookingBlock = findBlock(blocks, 'booking', 'cta')
  const bookingNote = cleanCmsText(bookingBlock?.data?.note)
  const bookingLabel = cleanCmsText(bookingBlock?.data?.label)
  const booking = bookingBlock
    ? {
        docId,
        blockKey: bookingBlock.key,
        ...(bookingNote ? { note: bookingNote } : {}),
        ...(bookingLabel ? { label: bookingLabel } : {}),
      }
    : undefined

  return {
    docId,
    ...(hero ? { hero } : {}),
    ...(services ? { services } : {}),
    ...(philosophy ? { philosophy } : {}),
    ...(methods ? { methods } : {}),
    ...(testimonials ? { testimonials } : {}),
    ...(newsletter ? { newsletter } : {}),
    ...(booking ? { booking } : {}),
  }
}

export interface ExtractedServiceLandingCmsData {
  docId: string
  hero?: {
    eyebrow?: string
    heading?: [string, string?]
    lede?: string
    ctaLabel?: string
    image?: ResolvedCmsImage
  }
  services?: {
    title?: string
    intro?: string
    items?: Array<{ title?: string, body?: string }>
  }
  approche?: {
    title?: string
    body?: string
    paragraphs?: string[]
  }
  apropos?: {
    title?: string
    items?: Array<{ title?: string, subtitle?: string, body?: string }>
  }
  tarif?: {
    note?: string
    label?: string
  }
  service?: {
    id: string
    title?: string
    description?: string
    durationMinutes?: number | null
    priceCents?: number | null
  }
}

export function extractServiceLandingCmsData(
  page: PageDoc | null | undefined,
  handle: 'coaching-de-couple' | 'therapie-individuelle',
): ExtractedServiceLandingCmsData {
  const docId = page?.id || pageDocId(handle)
  const blocks = flattenPageBlocks(page)

  const heroBlock = findBlock(blocks, 'hero', 'hero')
  const heroImg = resolveCmsImage(heroBlock?.data?.image)
  const h0 = cleanCmsText(heroBlock?.data?.heading?.[0])
  const h1 = cleanCmsText(heroBlock?.data?.heading?.[1])
  const heroEyebrow = cleanCmsText(heroBlock?.data?.eyebrow)
  const heroLede = cleanCmsText(heroBlock?.data?.lede)
  const heroCtaLabel = cleanCmsText(heroBlock?.data?.cta?.label)
  const heroHeading: [string, string?] | undefined = h0 ? (h1 ? [h0, h1] : [h0]) : undefined
  const hero = heroBlock
    ? {
        ...(heroEyebrow ? { eyebrow: heroEyebrow } : {}),
        ...(heroHeading ? { heading: heroHeading } : {}),
        ...(heroLede ? { lede: heroLede } : {}),
        ...(heroCtaLabel ? { ctaLabel: heroCtaLabel } : {}),
        ...(heroImg ? { image: heroImg } : {}),
      }
    : undefined

  const servicesBlock = findBlock(blocks, 'services', 'list')
  const servicesTitle = cleanCmsText(servicesBlock?.data?.title)
  const servicesIntro = cleanCmsText(servicesBlock?.data?.intro)
  const services = servicesBlock
    ? {
        ...(servicesTitle ? { title: servicesTitle } : {}),
        ...(servicesIntro ? { intro: servicesIntro } : {}),
        ...(Array.isArray(servicesBlock.data.items) && servicesBlock.data.items.length > 0
          ? {
              items: servicesBlock.data.items.map((it) => {
                const t = cleanCmsText(it.title)
                const b = cleanCmsText(it.body)
                return {
                  ...(t ? { title: t } : {}),
                  ...(b ? { body: b } : {}),
                }
              }),
            }
          : {}),
      }
    : undefined

  const approcheBlock = findBlock(blocks, 'approche', 'rich_text')
  const approcheParagraphs = richTextToPlain(approcheBlock?.data?.body)
  const approcheTitle = cleanCmsText(approcheBlock?.data?.title)
  const approche = approcheBlock
    ? {
        ...(approcheTitle ? { title: approcheTitle } : {}),
        ...(approcheParagraphs[0] ? { body: approcheParagraphs[0], paragraphs: approcheParagraphs } : {}),
      }
    : undefined

  const aproposBlock = findBlock(blocks, 'apropos', 'list')
  const aproposTitle = cleanCmsText(aproposBlock?.data?.title)
  const apropos = aproposBlock
    ? {
        ...(aproposTitle ? { title: aproposTitle } : {}),
        ...(Array.isArray(aproposBlock.data.items) && aproposBlock.data.items.length > 0
          ? {
              items: aproposBlock.data.items.map((it) => {
                const t = cleanCmsText(it.title)
                const s = cleanCmsText(it.subtitle)
                const b = cleanCmsText(it.body)
                return {
                  ...(t ? { title: t } : {}),
                  ...(s ? { subtitle: s } : {}),
                  ...(b ? { body: b } : {}),
                }
              }),
            }
          : {}),
      }
    : undefined

  const tarifBlock = findBlock(blocks, 'tarif', 'cta')
  const tarifNote = cleanCmsText(tarifBlock?.data?.note)
  const tarifLabel = cleanCmsText(tarifBlock?.data?.label)
  const tarif = tarifBlock
    ? {
        ...(tarifNote ? { note: tarifNote } : {}),
        ...(tarifLabel ? { label: tarifLabel } : {}),
      }
    : undefined

  const allServices = collectServiceItems(blocks)
  const serviceItem = findServiceItem(allServices, handle)
  const svcItemTitle = cleanCmsText(serviceItem?.title)
  const svcItemDesc = cleanCmsText(serviceItem?.description)
  const service = serviceItem
    ? {
        id: serviceItem.id || serviceDocId(handle),
        ...(svcItemTitle ? { title: svcItemTitle } : {}),
        ...(svcItemDesc ? { description: svcItemDesc } : {}),
        durationMinutes: typeof serviceItem.attrs?.duration_minutes === 'number' ? serviceItem.attrs.duration_minutes : null,
        priceCents: serviceItem.priceCents,
      }
    : undefined

  return {
    docId,
    ...(hero ? { hero } : {}),
    ...(services ? { services } : {}),
    ...(approche ? { approche } : {}),
    ...(apropos ? { apropos } : {}),
    ...(tarif ? { tarif } : {}),
    ...(service ? { service } : {}),
  }
}

export interface ExtractedBookingLpCmsData {
  docId: string
  hero?: {
    eyebrow?: string
    heading?: [string, string?]
    lede?: string
    ctaLabel?: string
    image?: ResolvedCmsImage
  }
  etapes?: {
    title?: string
    items?: Array<{ title?: string, body?: string }>
  }
  temoignages?: {
    title?: string
    items?: Array<{ title?: string, subtitle?: string, body?: string }>
  }
  faq?: {
    title?: string
    items?: Array<{ title?: string, body?: string }>
  }
  cta?: {
    note?: string
    label?: string
  }
}

export function extractBookingLpCmsData(page?: PageDoc | null): ExtractedBookingLpCmsData {
  const docId = page?.id || pageDocId('prendre-rendez-vous')
  const blocks = flattenPageBlocks(page)

  const heroBlock = findBlock(blocks, 'hero', 'hero')
  const heroImg = resolveCmsImage(heroBlock?.data?.image)
  const h0 = cleanCmsText(heroBlock?.data?.heading?.[0])
  const h1 = cleanCmsText(heroBlock?.data?.heading?.[1])
  const heroEyebrow = cleanCmsText(heroBlock?.data?.eyebrow)
  const heroLede = cleanCmsText(heroBlock?.data?.lede)
  const heroCtaLabel = cleanCmsText(heroBlock?.data?.cta?.label)
  const heroHeading: [string, string?] | undefined = h0 ? (h1 ? [h0, h1] : [h0]) : undefined
  const hero = heroBlock
    ? {
        ...(heroEyebrow ? { eyebrow: heroEyebrow } : {}),
        ...(heroHeading ? { heading: heroHeading } : {}),
        ...(heroLede ? { lede: heroLede } : {}),
        ...(heroCtaLabel ? { ctaLabel: heroCtaLabel } : {}),
        ...(heroImg ? { image: heroImg } : {}),
      }
    : undefined

  const etapesBlock = findBlock(blocks, 'etapes', 'list')
  const etapesTitle = cleanCmsText(etapesBlock?.data?.title)
  const etapes = etapesBlock
    ? {
        ...(etapesTitle ? { title: etapesTitle } : {}),
        ...(Array.isArray(etapesBlock.data.items) && etapesBlock.data.items.length > 0
          ? {
              items: etapesBlock.data.items.map((it) => {
                const t = cleanCmsText(it.title)
                const b = cleanCmsText(it.body)
                return {
                  ...(t ? { title: t } : {}),
                  ...(b ? { body: b } : {}),
                }
              }),
            }
          : {}),
      }
    : undefined

  const temoignagesBlock = findBlock(blocks, 'temoignages', 'list')
  const temoignagesTitle = cleanCmsText(temoignagesBlock?.data?.title)
  const temoignages = temoignagesBlock
    ? {
        ...(temoignagesTitle ? { title: temoignagesTitle } : {}),
        ...(Array.isArray(temoignagesBlock.data.items) && temoignagesBlock.data.items.length > 0
          ? {
              items: temoignagesBlock.data.items.map((it) => {
                const t = cleanCmsText(it.title)
                const s = cleanCmsText(it.subtitle)
                const b = cleanCmsText(it.body)
                return {
                  ...(t ? { title: t } : {}),
                  ...(s ? { subtitle: s } : {}),
                  ...(b ? { body: b } : {}),
                }
              }),
            }
          : {}),
      }
    : undefined

  const faqBlock = findBlock(blocks, 'faq', 'list')
  const faqTitle = cleanCmsText(faqBlock?.data?.title)
  const faq = faqBlock
    ? {
        ...(faqTitle ? { title: faqTitle } : {}),
        ...(Array.isArray(faqBlock.data.items) && faqBlock.data.items.length > 0
          ? {
              items: faqBlock.data.items.map((it) => {
                const t = cleanCmsText(it.title)
                const b = cleanCmsText(it.body)
                return {
                  ...(t ? { title: t } : {}),
                  ...(b ? { body: b } : {}),
                }
              }),
            }
          : {}),
      }
    : undefined

  const ctaBlock = findBlock(blocks, 'cta', 'cta')
  const ctaNote = cleanCmsText(ctaBlock?.data?.note)
  const ctaLabel = cleanCmsText(ctaBlock?.data?.label)
  const cta = ctaBlock
    ? {
        ...(ctaNote ? { note: ctaNote } : {}),
        ...(ctaLabel ? { label: ctaLabel } : {}),
      }
    : undefined

  return {
    docId,
    ...(hero ? { hero } : {}),
    ...(etapes ? { etapes } : {}),
    ...(temoignages ? { temoignages } : {}),
    ...(faq ? { faq } : {}),
    ...(cta ? { cta } : {}),
  }
}

export interface ExtractedBlogIndexCmsData {
  docId: string
  hero?: {
    docId: string
    blockKey: string
    blockType: 'heading' | 'hero'
    eyebrow?: string
    title?: string
    lede?: string
  }
}

export function extractBlogIndexCmsData(page?: PageDoc | null): ExtractedBlogIndexCmsData {
  const docId = page?.id || pageDocId('blog')
  const blocks = flattenPageBlocks(page)
  const heroHeading = findBlock(blocks, 'hero', 'heading')
  const heroBlock = findBlock(blocks, 'hero', 'hero')
  const blockType: 'heading' | 'hero' = heroHeading ? 'heading' : (heroBlock ? 'hero' : 'heading')
  const blockKey = heroHeading?.key ?? heroBlock?.key ?? 'hero'
  const eyebrow = cleanCmsText(heroHeading?.data?.eyebrow ?? heroBlock?.data?.eyebrow)
  const title = cleanCmsText(heroHeading?.data?.title ?? heroBlock?.data?.heading?.[0])
  const lede = cleanCmsText(heroHeading?.data?.lede ?? heroBlock?.data?.lede)
  const hero = (heroHeading || heroBlock)
    ? {
        docId,
        blockKey,
        blockType,
        ...(eyebrow ? { eyebrow } : {}),
        ...(title ? { title } : {}),
        ...(lede ? { lede } : {}),
      }
    : undefined
  return {
    docId,
    ...(hero ? { hero } : {}),
  }
}
