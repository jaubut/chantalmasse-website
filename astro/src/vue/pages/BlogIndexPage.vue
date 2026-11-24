<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <section
      class="px-8 lg:px-20 pt-32 pb-16"
      v-bind="tlsBlockAttrs(on, 'hero', 'heading')"
    >
      <div class="max-w-screen-xl mx-auto">
        <span
          class="inline-flex items-center bg-secondary-fixed text-on-secondary-container text-xs uppercase tracking-widest rounded-full px-4 py-2 mb-6"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'eyebrow')"
        >
          {{ cmsHero?.eyebrow || 'Ressources & Réflexions' }}
        </span>
        <h1
          class="font-headline text-6xl lg:text-7xl text-primary leading-tight lg:leading-none tracking-tight max-w-2xl"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'title')"
        >
          <template v-if="cmsHero?.title">{{ cmsHero.title }}</template>
          <template v-else>Le <span class="italic">blogue</span></template>
        </h1>
        <p
          class="mt-6 text-on-surface-variant text-lg font-light max-w-xl"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'lede')"
        >
          {{ cmsHero?.lede || 'Des réflexions sur le mieux-être, les relations et la croissance personnelle.' }}
        </p>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mt-10">
          <button
            class="text-xs uppercase tracking-widest rounded-full px-4 py-2 transition-colors duration-200"
            :class="activeFilter === null
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
            @click="activeFilter = null"
          >
            Tous
          </button>
          <button
            v-for="cat in categories"
            :key="cat.value"
            class="text-xs uppercase tracking-widest rounded-full px-4 py-2 transition-colors duration-200"
            :class="activeFilter === cat.value
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
            @click="activeFilter = cat.value"
          >
            {{ cat.label }}
          </button>
        </div>
      </div>
    </section>

    <!-- Posts grid (read from the TLS CMS via allPosts) -->
    <section
      class="px-8 lg:px-20 pb-24"
      v-bind="tlsBlockAttrs(on, 'posts', 'collection')"
    >
      <div
        class="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        v-bind="tlsCollectionAttrs(on, 'post')"
      >
        <a
          v-for="post in filteredPosts"
          :key="post.slug"
          :href="`/blog/${post.slug}`"
          class="group flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow hover:shadow-lg transition-shadow duration-300"
          v-bind="tlsItemAttrs(on, resolvePostId(post), 'post')"
        >
          <!-- Image -->
          <div class="aspect-[16/9] overflow-hidden">
            <img
              :src="post.image"
              :alt="post.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              v-bind="tlsPostHeroImageAttrs(on, resolvePostId(post))"
            />
          </div>

          <!-- Content -->
          <div class="flex flex-col flex-1 p-6 gap-4">
            <!-- Category + read time -->
            <div class="flex items-center justify-between">
              <span class="text-xs uppercase tracking-widest text-on-secondary-container bg-secondary-fixed rounded-full px-3 py-1">
                {{ post.category }}
              </span>
              <span v-if="post.readTime != null" class="text-xs text-on-surface-variant font-light">
                {{ post.readTime }} min
              </span>
            </div>

            <!-- Title -->
            <h2
              class="font-headline text-xl text-primary leading-snug group-hover:text-primary-container transition-colors"
              v-bind="tlsEntryFieldAttrs(on, resolvePostId(post), 'title')"
            >
              {{ post.title }}
            </h2>

            <!-- Excerpt -->
            <p
              class="text-on-surface-variant text-sm font-light leading-relaxed flex-1 line-clamp-3"
              v-bind="tlsExtFieldAttrs(on, resolvePostId(post), 'excerpt')"
            >
              {{ post.excerpt }}
            </p>

            <!-- Date + arrow -->
            <div class="flex items-center justify-between pt-2 border-t border-outline-variant/30">
              <span class="text-xs text-on-surface-variant font-light">
                {{ formatDate(post.date) }}
              </span>
              <span class="text-primary text-sm font-semibold group-hover:translate-x-1 transition-transform">
                Lire →
              </span>
            </div>
          </div>
        </a>
      </div>

      <p v-if="filteredPosts?.length === 0" class="text-center text-on-surface-variant font-light mt-16">
        Aucun article dans cette catégorie.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
// pages/blog/index.vue (Nuxt) as an island: the category filter is client state. Posts come from the CMS (src/lib/blog.ts).
import { computed, ref } from 'vue'
import type { BlogPost } from '../../lib/cms-client'
import {
  pageDocId,
  postDocId,
  tlsBlockAttrs,
  tlsBlockFieldAttrs,
  tlsCollectionAttrs,
  tlsEntryFieldAttrs,
  tlsExtFieldAttrs,
  tlsItemAttrs,
  tlsPostHeroImageAttrs,
} from '../../lib/tls-edit-attrs'

export interface CmsBlogHeroData {
  docId?: string
  eyebrow?: string
  title?: string
  lede?: string
}

const props = defineProps<{
  posts: Array<BlogPost & { id?: string }>
  previewMode?: boolean
  cmsHero?: CmsBlogHeroData
}>()
const on = computed(() => Boolean(props.previewMode))
const docId = computed(() => props.cmsHero?.docId || pageDocId('blog'))
const resolvePostId = (p: { id?: string; slug: string }): string => p.id || postDocId(p.slug)

const categoryLabels: Record<string, string> = {
  couple: 'Couple',
  individuelle: 'Thérapie individuelle',
  anxiete: 'Anxiété',
  'bien-etre': 'Bien-être',
  communication: 'Communication',
  schemas: 'Schémas relationnels',
  saisons: 'Saisons de vie',
}

const posts = computed(() => props.posts)
const activeFilter = ref<string | null>(null)

const categories = computed(() => {
  const seen = new Set<string>()
  return (posts.value ?? [])
    .map(p => p.category)
    .filter((c): c is string => Boolean(c) && !seen.has(c) && !!seen.add(c))
    .map(value => ({
      value,
      label: categoryLabels[value] ?? value.charAt(0).toUpperCase() + value.slice(1),
    }))
})

const filteredPosts = computed(() =>
  activeFilter.value === null
    ? posts.value
    : (posts.value ?? []).filter(p => p.category === activeFilter.value)
)

function formatDate(dateStr: string): string {
  // Frontmatter dates are calendar dates (YYYY-MM-DD = UTC midnight): format in UTC
  // so the server and a Quebec browser render the same day (no hydration mismatch).
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>
