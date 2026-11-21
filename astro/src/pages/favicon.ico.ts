// Same placeholder @nuxtjs/seo served at /favicon.ico (the site declares no icon): browsers stop logging a 404 for it.
import type { APIRoute } from 'astro'

export const prerender = true

export const GET: APIRoute = () => new Response('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', { headers: { 'content-type': 'image/x-icon' } })
