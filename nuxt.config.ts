// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: true,

  nitro: {
    preset: 'vercel',
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
