<template>
  <div class="min-h-screen bg-background">
    <article v-if="post">
      <!-- Hero image -->
      <div class="w-full aspect-[21/9] overflow-hidden">
        <img
          :src="post.image"
          :alt="post.title"
          class="w-full h-full object-cover"
        />
      </div>

      <!-- Post header -->
      <div class="px-8 lg:px-20 pt-16 pb-8">
        <div class="max-w-3xl mx-auto">
          <div class="flex items-center gap-4 mb-6">
            <span class="text-xs uppercase tracking-widest text-on-secondary-container bg-secondary-fixed rounded-full px-3 py-1">
              {{ post.category }}
            </span>
            <span class="text-xs text-on-surface-variant font-light">{{ post.readTime }} min de lecture</span>
            <span class="text-xs text-on-surface-variant font-light">{{ formatDate(post.date) }}</span>
          </div>

          <h1 class="font-headline text-4xl lg:text-6xl text-primary leading-tight tracking-tight mb-6">
            {{ post.title }}
          </h1>

          <p class="text-on-surface-variant text-xl font-light leading-relaxed border-l-4 border-primary-fixed pl-6">
            {{ post.excerpt }}
          </p>
        </div>
      </div>

      <!-- Post body -->
      <div class="px-8 lg:px-20 pb-24">
        <div class="max-w-3xl mx-auto">
          <div class="prose prose-lg prose-stone max-w-none
            prose-headings:font-headline prose-headings:text-primary prose-headings:tracking-tight
            prose-p:text-on-surface-variant prose-p:font-light prose-p:leading-relaxed
            prose-a:text-primary prose-a:underline hover:prose-a:text-primary-container
            prose-strong:text-on-surface prose-strong:font-semibold
            prose-li:text-on-surface-variant prose-li:font-light
            prose-hr:border-outline-variant/30">
            <ContentRenderer :value="post" />
          </div>

          <!-- Back link -->
          <div class="mt-16 pt-8 border-t border-outline-variant/30">
            <NuxtLink
              to="/blog"
              class="inline-flex items-center gap-2 text-primary font-semibold hover:-translate-x-1 transition-transform"
            >
              ← Retour au blogue
            </NuxtLink>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string

const { data: post } = await useAsyncData(`blog-${slug}`, () =>
  queryCollection('blog').where('slug', '=', slug).first()
)

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
}

useSeoMeta({
  title: () => post.value ? `${post.value.title} — Chantal Massé` : 'Chantal Massé',
  description: () => post.value?.excerpt ?? '',
  ogImage: () => post.value?.image ?? '',
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>
