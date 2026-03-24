// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  nitro: {
    // Using 'vercel' preset (not 'vercel-static') to support API routes for booking.
    // Page routes are pre-rendered at build time via routeRules below.
    preset: 'vercel',
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
  ],

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
