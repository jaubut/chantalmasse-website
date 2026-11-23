<template>
  <div class="min-h-screen bg-background">
    <article v-bind="tlsItemAttrs(on, docId, 'post')">
      <!-- Hero image -->
      <div class="w-full aspect-[21/9] overflow-hidden">
        <img
          :src="post.image"
          :srcset="heroSrcset"
          sizes="100vw"
          fetchpriority="high"
          :alt="post.title"
          class="w-full h-full object-cover"
          v-bind="tlsPostHeroImageAttrs(on, docId)"
        />
      </div>

      <!-- Post header -->
      <div class="px-8 lg:px-20 pt-16 pb-8">
        <div class="max-w-3xl mx-auto">
          <div class="flex items-center gap-4 mb-6">
            <span class="text-xs uppercase tracking-widest text-on-secondary-container bg-secondary-fixed rounded-full px-3 py-1">
              {{ post.category }}
            </span>
            <span v-if="post.readTime != null" class="text-xs text-on-surface-variant font-light">{{ post.readTime }} min de lecture</span>
            <span class="text-xs text-on-surface-variant font-light">{{ formatDate(post.date) }}</span>
          </div>

          <h1
            class="font-headline text-4xl lg:text-6xl text-primary leading-tight lg:leading-none tracking-tight mb-6"
            v-bind="tlsEntryFieldAttrs(on, docId, 'title')"
          >
            {{ post.title }}
          </h1>

          <p
            class="text-on-surface-variant text-xl font-light leading-relaxed border-l-4 border-primary-fixed pl-6"
            v-bind="tlsExtFieldAttrs(on, docId, 'excerpt')"
          >
            {{ post.excerpt }}
          </p>
        </div>
      </div>

      <!-- Post body -->
      <div class="px-8 lg:px-20 pb-24">
        <div class="max-w-3xl mx-auto">
          <div
            class="prose prose-lg max-w-none

            prose-p:text-on-surface-variant prose-p:font-light prose-p:leading-[1.85] prose-p:text-[1.0625rem]

            prose-h2:font-headline prose-h2:text-primary prose-h2:text-3xl prose-h2:font-normal
            prose-h2:tracking-tight prose-h2:mt-14 prose-h2:mb-4 prose-h2:leading-snug
            prose-h3:font-headline prose-h3:text-primary-container prose-h3:text-xl prose-h3:font-normal
            prose-h3:tracking-tight prose-h3:mt-8 prose-h3:mb-3 prose-h3:leading-snug

            prose-strong:text-on-surface prose-strong:font-semibold

            prose-a:text-primary prose-a:font-medium prose-a:underline prose-a:decoration-primary-fixed
            prose-a:underline-offset-2 prose-a:hover:decoration-primary

            prose-ul:my-6 prose-ul:space-y-2
            prose-ol:my-6 prose-ol:space-y-2
            prose-li:text-on-surface-variant prose-li:font-light prose-li:leading-relaxed
            prose-li:marker:text-primary-fixed-dim

            prose-blockquote:border-l-4 prose-blockquote:border-primary-fixed
            prose-blockquote:bg-surface-container prose-blockquote:rounded-r-xl
            prose-blockquote:px-6 prose-blockquote:py-4 prose-blockquote:my-8
            prose-blockquote:text-on-surface-variant prose-blockquote:font-light prose-blockquote:not-italic

            prose-hr:border-outline-variant/30 prose-hr:my-12

            prose-code:text-primary prose-code:bg-surface-container prose-code:px-1.5
            prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium
            prose-code:before:content-none prose-code:after:content-none"
            v-bind="tlsExtFieldAttrs(on, docId, 'body')"
            v-html="bodyHtml"
          />

          <!-- Back link -->
          <div class="mt-16 pt-8 border-t border-outline-variant/30">
            <a
              href="/blog"
              class="inline-flex items-center gap-2 text-primary font-semibold hover:-translate-x-1 transition-transform"
            >
              ← Retour au blogue
            </a>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="px-8 lg:px-20 py-20 bg-primary">
        <div class="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <!-- Booking -->
          <div>
            <p class="text-primary-fixed-dim text-sm uppercase tracking-widest font-light mb-4">Prochaine étape</p>
            <h2 class="font-headline text-4xl lg:text-5xl italic text-white mb-6 leading-tight lg:leading-none">
              Prêt à aller plus loin ?
            </h2>
            <p class="text-primary-fixed-dim font-light text-lg mb-10">
              Un espace confidentiel, sans jugement, pour explorer ce qui vous habite. Consultations en personne à Shefford ou en vidéoconférence.
            </p>
            <button
              class="inline-block bg-primary-fixed text-primary px-10 py-4 rounded-xl font-semibold hover:scale-105 transition-transform"
              data-booking-open
            >
              Prendre rendez-vous
            </button>
          </div>

          <!-- Newsletter -->
          <slot name="newsletter" />

        </div>
      </div>

      <!-- Recommended articles -->
      <div v-if="relatedPosts.length > 0" class="px-8 lg:px-20 py-20 bg-surface-container-low">
        <div class="max-w-screen-xl mx-auto">
          <p class="text-xs uppercase tracking-widest text-on-surface-variant font-light mb-10">À lire aussi</p>
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            v-bind="tlsCollectionAttrs(on, 'post')"
          >
            <a
              v-for="r in relatedPosts"
              :key="r.slug"
              :href="`/blog/${r.slug}`"
              class="group bg-background rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              v-bind="tlsItemAttrs(on, resolvePostId(r), 'post')"
            >
              <div class="aspect-[16/9] overflow-hidden">
                <img
                  :src="r.image"
                  :alt="r.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  v-bind="tlsPostHeroImageAttrs(on, resolvePostId(r))"
                />
              </div>
              <div class="p-6">
                <span class="text-xs uppercase tracking-widest text-on-secondary-container bg-secondary-fixed rounded-full px-3 py-1 mb-4 inline-block">
                  {{ r.category }}
                </span>
                <h3
                  class="font-headline text-xl text-primary leading-snug mb-2 group-hover:underline decoration-primary-fixed underline-offset-2"
                  v-bind="tlsEntryFieldAttrs(on, resolvePostId(r), 'title')"
                >
                  {{ r.title }}
                </h3>
                <p
                  class="text-sm text-on-surface-variant font-light line-clamp-2"
                  v-bind="tlsExtFieldAttrs(on, resolvePostId(r), 'excerpt')"
                >{{ r.excerpt }}</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlogPost } from '../../lib/cms-client'
import {
  postDocId,
  tlsCollectionAttrs,
  tlsEntryFieldAttrs,
  tlsExtFieldAttrs,
  tlsItemAttrs,
  tlsPostHeroImageAttrs,
} from '../../lib/tls-edit-attrs'

const props = defineProps<{
  post: BlogPost
  docId: string
  heroSrcset: string
  bodyHtml: string
  relatedPosts: BlogPost[]
  previewMode?: boolean
}>()

const on = computed(() => Boolean(props.previewMode))
const resolvePostId = (p: { id?: string; slug: string }): string => p.id || postDocId(p.slug)

function formatDate(dateStr: string): string {
  // Calendar dates (YYYY-MM-DD = UTC midnight): format in UTC so every visitor sees the same day.
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>
