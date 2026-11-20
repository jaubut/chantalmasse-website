// Browser glue for every page, bundled once by the layout. What Nuxt did in app.vue and plugins/*.client.ts:
//   - the page veil between pages (plugins/page-veil.client.ts), now on the ClientRouter lifecycle
//   - data-booking-open / data-contact-open on static markup open the shared modals (the islands render them)
//   - PostHog (plugins/posthog.client.ts), one $pageview per page load including ClientRouter navigations
// Nothing analytics-related runs on /confirmer-inscription: its URL fragment holds a private token.
import posthog from 'posthog-js'
import { useBooking } from '../vue/composables/useBooking'
import { useContact } from '../vue/composables/useContact'
import type { BookingServiceId } from '~/utils/bookingServices'

const PRIVATE_PATH = /^\/confirmer-inscription\/?$/
const html = document.documentElement

// ---------- page veil (styles: .cm-veil in assets/css/main.css) ----------
const MOVE_MS = 500
const FADE_MS = 150
const reduce = matchMedia('(prefers-reduced-motion: reduce)')
const veilMs = (): number => (reduce.matches ? FADE_MS : MOVE_MS)
let veil: HTMLDivElement | undefined
let covering = false
let safety: ReturnType<typeof setTimeout> | undefined

function veilEl(): HTMLDivElement {
  if (veil?.isConnected) return veil
  veil = document.createElement('div')
  veil.className = 'cm-veil'
  veil.setAttribute('aria-hidden', 'true')
  veil.innerHTML = '<span class="font-headline italic text-4xl sm:text-5xl text-secondary">Chantal Massé</span>'
  document.body.appendChild(veil)
  return veil
}

function lift(): void {
  if (!covering) return
  covering = false
  clearTimeout(safety)
  const v = veilEl()
  // Two frames so the new page's reveal script (Base.astro) has run: its content is already shown under the panel.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    v.classList.replace('is-in', 'is-out')
    setTimeout(() => {
      v.classList.remove('is-out')
      html.classList.remove('cm-veiling')
    }, veilMs())
  }))
}

document.addEventListener('astro:before-preparation', (e) => {
  const ev = e as Event & { from: URL, to: URL, loader: () => Promise<void> }
  if (ev.from.pathname === ev.to.pathname || covering) return
  covering = true
  html.classList.add('cm-veiling')
  const v = veilEl()
  v.classList.remove('is-out')
  v.classList.add('is-in')
  safety = setTimeout(lift, 3000) // never leave the panel down if the page never finishes
  const load = ev.loader
  ev.loader = async () => {
    await Promise.all([load(), new Promise(r => setTimeout(r, veilMs()))])
  }
})
// The new <body> replaced the old one (and the veil with it): put the covering panel back before it lifts.
document.addEventListener('astro:after-swap', () => {
  if (!covering) return
  html.classList.add('cm-veiling')
  veilEl().classList.add('is-in')
})

// ---------- modals opened from static markup ----------
document.addEventListener('click', (e) => {
  const target = (e.target as Element | null)?.closest<HTMLElement>('[data-booking-open], [data-contact-open]')
  if (!target) return
  e.preventDefault()
  if (target.hasAttribute('data-contact-open')) useContact().open()
  else useBooking().open((target.dataset.bookingOpen || undefined) as BookingServiceId | undefined)
})

// ---------- analytics ----------
const POSTHOG_KEY = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined
const POSTHOG_HOST = (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'
if (POSTHOG_KEY && !PRIVATE_PATH.test(location.pathname)) {
  // Cookieless, every input masked: same options as plugins/posthog.client.ts.
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    persistence: 'memory',
    autocapture: true,
    capture_pageview: false, // sent below on every page load, soft navigations included
    capture_pageleave: true,
    before_send: event => (PRIVATE_PATH.test(location.pathname) ? null : event),
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-posthog-mask], a[href^='tel:'], a[href^='mailto:']",
    },
  })
}

// One PostHog $pageview per page load, ClientRouter navigations included (plugins/posthog.client.ts did it on
// router.afterEach). GA4/Ads and Meta need nothing here: their own history listeners count each navigation once.
function trackPageView(): void {
  if (POSTHOG_KEY && !PRIVATE_PATH.test(location.pathname)) posthog.capture('$pageview', { $current_url: location.href, path: location.pathname })
}

document.addEventListener('astro:page-load', () => {
  lift()
  trackPageView()
})
