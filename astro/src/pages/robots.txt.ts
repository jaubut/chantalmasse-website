// Same body as @nuxtjs/robots served (comment lines included), so crawlers see no change at cutover.
import type { APIRoute } from 'astro'

export const prerender = true
const BODY = '# START nuxt-robots (indexable)\nUser-agent: *\nDisallow: \n\nSitemap: https://chantalmasse.com/sitemap.xml\n# END nuxt-robots'

export const GET: APIRoute = () => new Response(BODY, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
