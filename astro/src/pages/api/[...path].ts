// Every /api/* route: the repo's server/api handlers, unchanged, behind one h3 router (same paths and methods as Nitro).
import '../../lib/nitro'
import type { APIRoute } from 'astro'
import { createApp, createError, createRouter, defineEventHandler, getRequestURL, toWebHandler, type EventHandler } from 'h3'
import { nitroError } from '../../lib/nitro'
import availability from '~/server/api/booking/availability.get'
import cancelInfo from '~/server/api/booking/cancel-info.get'
import cancel from '~/server/api/booking/cancel.post'
import create from '~/server/api/booking/create.post'
import contact from '~/server/api/contact.post'
import imgProxy from '~/server/api/img-proxy.get'
import newsletterConfirm from '~/server/api/newsletter/confirm.post'
import newsletterSubscribe from '~/server/api/newsletter/subscribe.post'

export const prerender = false

const routes: Array<['get' | 'post', string, EventHandler]> = [
  ['get', '/api/booking/availability', availability],
  ['get', '/api/booking/cancel-info', cancelInfo],
  ['post', '/api/booking/cancel', cancel],
  ['post', '/api/booking/create', create],
  ['post', '/api/contact', contact],
  ['get', '/api/img-proxy', imgProxy],
  ['post', '/api/newsletter/confirm', newsletterConfirm],
  ['post', '/api/newsletter/subscribe', newsletterSubscribe],
]

const router = createRouter()
// A thrown createError() becomes Nitro's JSON error body (h3 alone would serialize its own shape).
for (const [method, path, handler] of routes)
  router[method](path, defineEventHandler(async (event) => {
    try {
      return await handler(event)
    } catch (error) {
      return nitroError(error, getRequestURL(event).href)
    }
  }))

const app = createApp({
  onRequest(event) {
    // Nitro gives handlers event.waitUntil (server/utils/bookingCache.ts refreshes KV in the background with it).
    const ctx = event.context.cloudflare as { waitUntil(p: Promise<unknown>): void } | undefined
    ;(event as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil = ctx ? (p) => ctx.waitUntil(p) : undefined
  },
})
app.use(router)
const web = toWebHandler(app)

export const ALL: APIRoute = async ({ request, locals }) => {
  const url = request.url
  const ctx = (locals as { cfContext?: unknown }).cfContext
  const res = await web(request, { cloudflare: ctx })
  // h3 answers an unmatched route with its own 404: turn it into Nitro's body, like the Nuxt Worker.
  if (res.status === 404 && res.headers.get('content-type')?.includes('json') && !(await res.clone().text()).includes('"message": "')) {
    const path = new URL(url).pathname
    return nitroError(createError({ statusCode: 404, statusMessage: `Page not found: ${path}`, data: { path } }), url)
  }
  return res
}
