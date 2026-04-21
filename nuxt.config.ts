// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  nitro: {
    // Using 'vercel' preset (not 'vercel-static') to support API routes for booking.
    // Page routes are pre-rendered at build time via routeRules below.
    preset: 'vercel',
    prerender: {
      crawlLinks: true,
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/journey': { prerender: true },
    '/blog': { prerender: true },
    '/blog/**': { prerender: true },
    '/mentions-legales': { prerender: true },
    '/confidentialite': { prerender: true },
    '/inscription-confirmee': { prerender: true },
    '/coaching-de-couple': { prerender: true },
    '/therapie-individuelle': { prerender: true },
    '/prendre-rendez-vous': { prerender: true },
    // /annuler is dynamic per token — must not be prerendered.
    '/annuler': { prerender: false, robots: false },
    // Legacy URLs from the Wix site — keep 301s so old ads / backlinks / bookmarks survive.
    '/coaching-relationnel-couple': { redirect: { to: '/coaching-de-couple', statusCode: 301 } },
    '/coaching-relationnel-de-couple-chantal': { redirect: { to: '/coaching-de-couple', statusCode: 301 } },
    '/therapie-individuelle-chantal': { redirect: { to: '/therapie-individuelle', statusCode: 301 } },
    // /book-online kept on / for now — flip to /prendre-rendez-vous if the A/B test wins.
    '/book-online': { redirect: { to: '/', statusCode: 301 } },
    '/booking-calendar': { redirect: { to: '/', statusCode: 301 } },
  },

  runtimeConfig: {
    // Server-only secrets
    googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
    googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM,
    emailTo: process.env.EMAIL_TO,
    bookingMinNoticeHours: process.env.BOOKING_MIN_NOTICE_HOURS || '24',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
    siteBaseUrl: process.env.SITE_BASE_URL || 'https://chantalmasse.com',
    // Exposed to client
    public: {
      bookingTimezone: process.env.BOOKING_TIMEZONE || 'America/Toronto',
      bookingAdvanceDays: process.env.BOOKING_ADVANCE_DAYS || '60',
    },
  },

  modules: [
    '@nuxt/content',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/google-fonts',
    '@nuxtjs/seo',
    '@nuxt/image',
  ],

  // ─── Site identity (used by sitemap, robots, schema.org) ───────────────────
  site: {
    url: 'https://chantalmasse.com',
    name: 'Chantal Massé — Thérapeute en relation d\'aide',
    description: 'Thérapie individuelle et coaching de couple à Shefford (Haute-Yamaska) et en vidéoconférence. Accompagnement bienveillant pour retrouver équilibre et sérénité.',
    defaultLocale: 'fr',
  },

  // ─── Sitemap ───────────────────────────────────────────────────────────────
  // crawlLinks: true in nitro means all prerendered routes are auto-discovered
  sitemap: {
    exclude: ['/inscription-confirmee'],
  },

  // ─── OG Image ──────────────────────────────────────────────────────────────
  // Blog posts already set ogImage via useSeoMeta (Wixstatic images).
  // Disable the Satori renderer to keep the build simple.
  ogImage: { enabled: false },

  // ─── Schema.org ────────────────────────────────────────────────────────────
  schemaOrg: {
    identity: {
      type: 'Person',
      name: 'Chantal Massé',
      description: 'Thérapeute en relation d\'aide et coach de couple, Shefford (Québec)',
      url: 'https://chantalmasse.com',
      sameAs: [],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Shefford',
        addressRegion: 'QC',
        addressCountry: 'CA',
      },
    },
  },

  // ─── Image ─────────────────────────────────────────────────────────────────
  image: {
    // Allow Wixstatic (blog post images) and the site's own domain
    domains: ['static.wixstatic.com', 'chantalmasse.com'],
  },

  googleFonts: {
    families: {
      Newsreader: {
        ital: [400, 600, 700],
        wght: [400, 600, 700],
      },
      Manrope: [300, 400, 600],
    },
    display: 'swap',
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: {
        lang: 'fr',
      },
      // Each page sets a full title; don't let @nuxtjs/seo append site.name a second time.
      titleTemplate: '%s',
      script: [
        {
          src: 'https://www.googletagmanager.com/gtag/js?id=G-465141726',
          async: true,
        },
        {
          innerHTML: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-465141726')",
        },
        {
          innerHTML: "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','948606391153047');fbq('track','PageView')",
        },
      ],
      noscript: [
        {
          innerHTML: '<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=948606391153047&ev=PageView&noscript=1"/>',
        },
      ],
    },
  },
})
