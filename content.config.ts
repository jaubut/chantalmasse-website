import { defineContentConfig, defineCollection, z } from '@nuxt/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'

export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: 'blog/**/*.md',
      schema: z.object({
        slug: z.string(),
        title: z.string(),
        date: z.string(),
        readTime: z.number(),
        category: z.string(),
        excerpt: z.string(),
        image: z.string(),
        originalUrl: z.string().optional(),
        // Lists every article in /sitemap.xml (loc = content path = /blog/<slug>).
        // onUrl is serialized via toString() into Nitro: keep it a self-contained
        // arrow function (method shorthand doesn't survive serialization).
        sitemap: defineSitemapSchema({
          z,
          name: 'blog',
          onUrl: (url, entry) => {
            url.lastmod = entry.date
          },
        }),
      }),
    }),
  },
})
