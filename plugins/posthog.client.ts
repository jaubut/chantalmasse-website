import posthog from 'posthog-js'

// Cookieless PostHog init for the Chantal site. The therapy context means
// even higher sensitivity than a typical commercial site — every input is
// masked in session replay, persistence is in-memory only (no cookies, no
// localStorage), and IPs are anonymized server-side.
//
// Loads only on the client (`.client.ts` suffix). When the key is missing
// (local dev), init is silently skipped and every `posthog.capture(...)` is
// a no-op, so existing tracking code never errors.
export default defineNuxtPlugin((nuxtApp) => {
  // Email confirmation fragments contain a private token. Do not initialize
  // analytics here, before Nuxt has finished restoring/clearing the fragment.
  if (/^\/confirmer-inscription\/?$/.test(window.location.pathname)) return
  const config = useRuntimeConfig()
  const key = config.public.posthogKey as string
  const host = config.public.posthogHost as string

  if (!key) {
    // No key configured — analytics disabled. Useful for local dev.
    return
  }

  posthog.init(key, {
    api_host: host,
    persistence: 'memory',
    autocapture: true,
    capture_pageview: false, // we fire $pageview manually below
    capture_pageleave: true,
    before_send: (event) => /^\/confirmer-inscription\/?$/.test(window.location.pathname) ? null : event,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-posthog-mask], a[href^='tel:'], a[href^='mailto:']",
    },
  })

  // Fire $pageview on every route change. Nuxt's router hook fires after the
  // route is resolved + DOM updated, so window.location.pathname is correct.
  const router = useRouter()
  router.afterEach((to) => {
    if (/^\/confirmer-inscription\/?$/.test(to.path)) return
    // First load already triggers afterEach in Nuxt 3, no need for an
    // explicit onMounted capture.
    posthog.capture('$pageview', {
      $current_url: window.location.origin + to.fullPath,
      path: to.path,
    })
  })

  // Expose to anyone who wants direct access (rare — prefer useTracking).
  nuxtApp.provide('posthog', posthog)
})

declare module '#app' {
  interface NuxtApp {
    $posthog: typeof posthog
  }
}
