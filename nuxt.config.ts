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
    '/blog': { prerender: true },
    '/blog/**': { prerender: true },
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
    // Admin dashboard
    adminPassword: process.env.ADMIN_PASSWORD,
    metaAccessToken: process.env.META_ACCESS_TOKEN,
    metaIgUserId: process.env.META_IG_USER_ID,
    metaFbPageId: process.env.META_FB_PAGE_ID,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    briefEmail: process.env.BRIEF_EMAIL,
    apifyApiToken: process.env.APIFY_API_TOKEN,
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

  // ─── Robots ────────────────────────────────────────────────────────────────
  robots: {
    // Block admin from indexing; /api is not crawled by bots anyway
    disallow: ['/admin'],
  },

  // ─── Sitemap ───────────────────────────────────────────────────────────────
  // crawlLinks: true in nitro means all prerendered routes are auto-discovered
  sitemap: {},

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
    },
  },
})
