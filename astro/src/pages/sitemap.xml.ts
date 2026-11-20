// /sitemap.xml: the same URL set @nuxtjs/sitemap emitted (indexable pages, no trailing slash, noindex pages excluded:
// /prendre-rendez-vous, /inscription-confirmee, /confirmer-inscription, /annuler) plus every published post from the CMS,
// with its publication date as <lastmod> (what content.config.ts asked @nuxtjs/sitemap for; the live Nuxt build dropped it).
import type { APIRoute } from 'astro'
import { allPosts } from '../lib/blog'
import { SITE_URL } from '../lib/seo'

export const prerender = false
const PAGES = ['/', '/blog', '/coaching-de-couple', '/confidentialite', '/confidentialite-infolettre', '/journey', '/mentions-legales', '/therapie-individuelle']

export const GET: APIRoute = async () => {
  const posts = (await allPosts()).sort((a, b) => a.path.localeCompare(b.path))
  const urls = [
    ...PAGES.map(p => ({ loc: p === '/' ? `${SITE_URL}/` : SITE_URL + p, lastmod: '' })),
    ...posts.map(p => ({ loc: SITE_URL + p.path, lastmod: p.date })),
  ]
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `    <url>\n        <loc>${u.loc}</loc>${u.lastmod ? `\n        <lastmod>${u.lastmod}</lastmod>` : ''}\n    </url>`).join('\n')
    + '\n</urlset>\n'
  return new Response(body, {
    headers: { 'content-type': 'text/xml; charset=UTF-8', 'cache-control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600' },
  })
}
