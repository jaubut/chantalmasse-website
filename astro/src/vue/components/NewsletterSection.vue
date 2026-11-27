<template>
  <section
    class="py-32 px-8 bg-tertiary text-on-tertiary"
    v-bind="tlsBlockAttrs(pageOn, blockKey, 'collection')"
  >
    <div class="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

      <!-- Left: form -->
      <div data-animate>
        <h2
          class="font-headline text-5xl mb-6"
          v-bind="tlsBlockFieldAttrs(pageOn, docId, blockKey, 'title')"
        >{{ cmsNewsletter?.title || 'Pensées & Réflexions' }}</h2>
        <p
          class="text-on-tertiary-container font-light text-lg mb-10 max-w-md"
          v-bind="tlsBlockFieldAttrs(pageOn, docId, blockKey, 'lede')"
        >
          {{ cmsNewsletter?.lede || 'Recevez mensuellement des pistes de réflexion, des pratiques de pleine conscience et des ressources pour nourrir vos relations.' }}
        </p>
        <form class="flex flex-col gap-4" @submit.prevent="subscribe">
          <div class="flex flex-col sm:flex-row gap-4">
            <label for="newsletter-email" class="sr-only">Courriel</label>
            <input
              id="newsletter-email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              maxlength="254"
              placeholder="votre@courriel.com"
              :disabled="loading || success"
              class="flex-1 bg-tertiary-container text-on-tertiary rounded-xl px-6 py-4 outline-hidden placeholder-on-tertiary-container/60 focus:ring-2 focus:ring-secondary-fixed/50 disabled:opacity-50"
            />
            <button
              type="submit"
              :disabled="loading || success"
              class="bg-secondary-fixed text-on-secondary-container px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform whitespace-nowrap disabled:opacity-50 disabled:scale-100"
            >
              {{ success ? 'Envoyé ✓' : loading ? '...' : "S'abonner" }}
            </button>
          </div>
          <!-- Honeypot: bots fill it, the dashboard then sends nothing -->
          <input v-model="website" type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <p class="text-sm text-on-tertiary-container font-light max-w-md">
            {{ NEWSLETTER_CONSENT_TEXT }}
            <a href="/confidentialite-infolettre" class="inline-block py-2 underline underline-offset-2">Confidentialité</a>
          </p>
        </form>
        <p role="status" aria-live="polite" class="mt-3 text-sm text-secondary-fixed">{{ success ? NEWSLETTER_SUCCESS : '' }}</p>
        <p v-if="error" role="alert" class="mt-3 text-sm text-red-400">{{ error }}</p>
      </div>

      <!-- Right: blog cards (read from the TLS CMS via latestPosts) -->
      <div
        class="grid grid-cols-1 sm:grid-cols-2 gap-6"
        data-animate
        v-bind="tlsCollectionAttrs(on, 'post')"
      >

        <a
          v-for="post in posts"
          :key="post.slug"
          :href="`/blog/${post.slug}`"
          class="bg-tertiary-container rounded-2xl overflow-hidden group soft-lift"
          v-bind="tlsItemAttrs(on, resolvePostId(post), 'post')"
        >
          <div class="aspect-[4/3] overflow-hidden">
            <img
              :src="post.image"
              :alt="post.title"
              class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              v-bind="tlsPostHeroImageAttrs(on, resolvePostId(post))"
            />
          </div>
          <div class="p-6">
            <span v-if="post.readTime != null" class="text-xs uppercase tracking-widest text-secondary-fixed-dim mb-3 block">Lecture {{ post.readTime }} min</span>
            <h4
              class="font-headline text-xl text-on-tertiary"
              v-bind="tlsEntryFieldAttrs(on, resolvePostId(post), 'title')"
            >{{ post.title }}</h4>
          </div>
        </a>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ofetch } from 'ofetch'
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_SUCCESS } from '~/utils/newsletterConsent'
import {
  pageDocId,
  postDocId,
  tlsBlockAttrs,
  tlsBlockFieldAttrs,
  tlsCollectionAttrs,
  tlsEntryFieldAttrs,
  tlsItemAttrs,
  tlsPostHeroImageAttrs,
} from '../../lib/tls-edit-attrs'

export interface CmsNewsletterBlockData {
  docId?: string
  blockKey?: string
  title?: string
  lede?: string
}

const props = withDefaults(
  defineProps<{
    posts: { id?: string; slug: string; title: string; image: string; readTime: number | null }[]
    previewMode?: boolean
    pagePreviewMode?: boolean
    cmsNewsletter?: CmsNewsletterBlockData
  }>(),
  { pagePreviewMode: undefined },
)

const on = computed(() => Boolean(props.previewMode))
const pageOn = computed(() => Boolean(props.pagePreviewMode ?? props.previewMode))
const docId = computed(() => props.cmsNewsletter?.docId || pageDocId('home'))
const blockKey = computed(() => props.cmsNewsletter?.blockKey || 'infolettre')
const resolvePostId = (p: { id?: string; slug: string }): string => p.id || postDocId(p.slug)

const email = ref('')
const website = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function subscribe() {
  error.value = ''
  loading.value = true
  try {
    await ofetch('/api/newsletter/subscribe', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        website: website.value,
      },
    })
    success.value = true
    email.value = ''
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Une erreur est survenue. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>
