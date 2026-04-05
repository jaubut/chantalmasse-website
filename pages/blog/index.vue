<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <section class="px-8 lg:px-20 pt-32 pb-16">
      <div class="max-w-screen-xl mx-auto">
        <span class="inline-flex items-center bg-secondary-fixed text-on-secondary-container text-xs uppercase tracking-widest rounded-full px-4 py-2 mb-6">
          Ressources & Réflexions
        </span>
        <h1 class="font-headline text-6xl lg:text-7xl text-primary leading-tight tracking-tight max-w-2xl">
          Le <span class="italic">blogue</span>
        </h1>
        <p class="mt-6 text-on-surface-variant text-lg font-light max-w-xl">
          Des réflexions sur le mieux-être, les relations et la croissance personnelle.
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

    <!-- Posts grid -->
    <section class="px-8 lg:px-20 pb-24">
      <div class="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <NuxtLink
          v-for="post in filteredPosts"
          :key="post.slug"
          :to="`/blog/${post.slug}`"
          class="group flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow hover:shadow-lg transition-shadow duration-300"
        >
          <!-- Image -->
          <div class="aspect-[16/9] overflow-hidden">
            <img
              :src="post.image"
              :alt="post.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          </div>

          <!-- Content -->
          <div class="flex flex-col flex-1 p-6 gap-4">
            <!-- Category + read time -->
            <div class="flex items-center justify-between">
              <span class="text-xs uppercase tracking-widest text-on-secondary-container bg-secondary-fixed rounded-full px-3 py-1">
                {{ post.category }}
              </span>
              <span class="text-xs text-on-surface-variant font-light">
                {{ post.readTime }} min
              </span>
            </div>

            <!-- Title -->
            <h2 class="font-headline text-xl text-primary leading-snug group-hover:text-primary-container transition-colors">
              {{ post.title }}
            </h2>

            <!-- Excerpt -->
            <p class="text-on-surface-variant text-sm font-light leading-relaxed flex-1 line-clamp-3">
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
        </NuxtLink>
      </div>

      <p v-if="filteredPosts?.length === 0" class="text-center text-on-surface-variant font-light mt-16">
        Aucun article dans cette catégorie.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
const categoryLabels: Record<string, string> = {
  couple: 'Couple',
  individuelle: 'Thérapie individuelle',
  anxiete: 'Anxiété',
  'bien-etre': 'Bien-être',
  communication: 'Communication',
  schemas: 'Schémas relationnels',
  saisons: 'Saisons de vie',
}

const { data: posts } = await useAsyncData('blog-posts', () =>
  queryCollection('blog').order('date', 'DESC').all()
)

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
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

useSeoMeta({
  title: 'Blogue — Chantal Massé',
  ogTitle: 'Blogue — Chantal Massé',
  description: 'Des réflexions sur le mieux-être, les relations et la croissance personnelle.',
  ogDescription: 'Des réflexions sur le mieux-être, les relations et la croissance personnelle.',
  ogImage: 'https://chantalmasse.com/images/chantal-hero.jpg',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://chantalmasse.com/blog' },
  ],
})
</script>
