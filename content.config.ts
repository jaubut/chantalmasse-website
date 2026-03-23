import { defineContentConfig, defineCollection, z } from '@nuxt/content'

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
      }),
    }),
  },
})
