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
          <div class="prose prose-lg max-w-none

            prose-p:text-on-surface-variant prose-p:font-light prose-p:leading-[1.85] prose-p:text-[1.0625rem]

            prose-h2:font-headline prose-h2:text-primary prose-h2:text-3xl prose-h2:font-normal
            prose-h2:tracking-tight prose-h2:mt-14 prose-h2:mb-4 prose-h2:leading-snug
            prose-h3:font-headline prose-h3:text-primary-container prose-h3:text-xl prose-h3:font-normal
            prose-h3:tracking-tight prose-h3:mt-8 prose-h3:mb-3 prose-h3:leading-snug

            prose-strong:text-on-surface prose-strong:font-semibold

            prose-a:text-primary prose-a:font-medium prose-a:underline prose-a:decoration-primary-fixed
            prose-a:underline-offset-2 hover:prose-a:decoration-primary

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
            prose-code:before:content-none prose-code:after:content-none">
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

      <!-- CTA -->
      <div class="px-8 lg:px-20 py-20 bg-primary">
        <div class="max-w-3xl mx-auto text-center">
          <p class="text-primary-fixed-dim text-sm uppercase tracking-widest font-light mb-4">Prochaine étape</p>
          <h2 class="font-headline text-4xl lg:text-5xl italic text-white mb-6 leading-tight">
            Prête à aller plus loin ?
          </h2>
          <p class="text-primary-fixed-dim font-light text-lg mb-10 max-w-xl mx-auto">
            Un espace confidentiel, sans jugement, pour explorer ce qui vous habite. Consultations en personne à Shefford ou en vidéoconférence.
          </p>
          <button
            class="inline-block bg-primary-fixed text-primary px-10 py-4 rounded-xl font-semibold hover:scale-105 transition-transform"
            @click="booking.open()"
          >
            Prendre rendez-vous
          </button>
        </div>
      </div>

      <!-- Recommended articles -->
      <div v-if="related?.length" class="px-8 lg:px-20 py-20 bg-surface-container-low">
        <div class="max-w-screen-xl mx-auto">
          <p class="text-xs uppercase tracking-widest text-on-surface-variant font-light mb-10">À lire aussi</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <NuxtLink
              v-for="r in related"
              :key="r.slug"
              :to="`/blog/${r.slug}`"
              class="group bg-background rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div class="aspect-[16/9] overflow-hidden">
                <img
                  :src="r.image"
                  :alt="r.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div class="p-6">
                <span class="text-xs uppercase tracking-widest text-on-secondary-container bg-secondary-fixed rounded-full px-3 py-1 mb-4 inline-block">
                  {{ r.category }}
                </span>
                <h3 class="font-headline text-xl text-primary leading-snug mb-2 group-hover:underline decoration-primary-fixed underline-offset-2">
                  {{ r.title }}
                </h3>
                <p class="text-sm text-on-surface-variant font-light line-clamp-2">{{ r.excerpt }}</p>
              </div>
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

const { data: related } = await useAsyncData(`blog-related-${slug}`, async () => {
  if (!post.value) return []
  const all = await queryCollection('blog').all()
  const others = all.filter(p => p.slug !== slug)
  const sameCategory = others.filter(p => p.category === post.value!.category).slice(0, 3)
  if (sameCategory.length >= 3) return sameCategory
  const fill = others.filter(p => p.category !== post.value!.category).slice(0, 3 - sameCategory.length)
  return [...sameCategory, ...fill]
})

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
}

useSeoMeta({
  title: () => post.value ? `${post.value.title} — Chantal Massé` : 'Chantal Massé',
  description: () => post.value?.excerpt ?? '',
  ogImage: () => post.value?.image ?? '',
})

const booking = useBooking()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>
