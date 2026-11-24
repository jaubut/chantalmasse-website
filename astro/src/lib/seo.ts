// Head metadata as the Nuxt site emits it (@nuxtjs/seo defaults + each page's useSeoMeta/useHead), so the parity crawl
// (scripts/parity-crawl.ts) sees the same title, meta, canonical and JSON-LD on every URL.
export const SITE_URL = 'https://chantalmasse.com'
export const SITE_NAME = "Chantal Massé — Thérapeute en relation d'aide"
export const SITE_DESCRIPTION = 'Thérapie individuelle et coaching de couple à Shefford (Haute-Yamaska) et en vidéoconférence. Accompagnement bienveillant pour retrouver équilibre et sérénité.'
export const HERO_IMAGE = `${SITE_URL}/images/chantal-og.jpg`
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

export interface Seo {
  title: string
  /** Path of the canonical URL ('/' for the home page). */
  path: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogType?: 'website' | 'article'
  robots?: string
  /** Blog posts: the Nuxt post page emits an empty description / og:description (kept for parity, fix after cutover). */
  emptyDescription?: boolean
}

export interface Head {
  title: string
  canonical: string
  meta: Array<{ name?: string, property?: string, content: string }>
  jsonLd: string
}

export function head(seo: Seo): Head {
  const canonical = seo.path === '/' ? SITE_URL : SITE_URL + seo.path
  const meta: Head['meta'] = [{ name: 'robots', content: seo.robots ?? DEFAULT_ROBOTS }]
  meta.push({ name: 'description', content: seo.emptyDescription ? '' : seo.description ?? SITE_DESCRIPTION })
  meta.push({ property: 'og:description', content: seo.emptyDescription ? '' : seo.ogDescription ?? seo.description ?? SITE_DESCRIPTION })
  meta.push(
    { property: 'og:type', content: seo.ogType ?? 'website' },
    { property: 'og:title', content: seo.ogTitle ?? seo.title },
    { name: 'twitter:card', content: 'summary_large_image' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:url', content: canonical },
  )
  if (seo.ogImage) meta.push({ property: 'og:image', content: seo.ogImage })

  const identity = { '@id': `${SITE_URL}/#identity` }
  const graph = [
    {
      '@id': `${SITE_URL}/#website`,
      '@type': 'WebSite',
      description: SITE_DESCRIPTION,
      inLanguage: 'fr',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      publisher: identity,
    },
    {
      '@id': `${canonical}#webpage`,
      '@type': 'WebPage',
      description: (!seo.emptyDescription && seo.description) || SITE_DESCRIPTION,
      name: seo.title,
      url: canonical,
      ...(seo.path === '/' ? { about: identity } : {}),
      isPartOf: { '@id': `${SITE_URL}/#website` },
      potentialAction: [{ '@type': 'ReadAction', target: [canonical] }],
    },
    {
      '@id': `${SITE_URL}/#identity`,
      '@type': 'Person',
      description: "Thérapeute en relation d'aide et coach de couple, Shefford (Québec)",
      name: 'Chantal Massé',
      url: SITE_URL,
      address: { '@type': 'PostalAddress', addressLocality: 'Shefford', addressRegion: 'QC', addressCountry: 'CA' },
      sameAs: [],
    },
  ]
  // '<' escaped so a title can never close the script element.
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
  return { title: seo.title, canonical, meta, jsonLd }
}
