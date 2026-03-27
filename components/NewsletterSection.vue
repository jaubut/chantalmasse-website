<template>
  <section class="py-32 px-8 bg-tertiary text-on-tertiary">
    <div class="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

      <!-- Left: form -->
      <div data-animate>
        <h2 class="font-headline text-5xl mb-6">Pensées &amp; Réflexions</h2>
        <p class="text-on-tertiary-container font-light text-lg mb-10 max-w-md">
          Recevez mensuellement des pistes de réflexion, des pratiques de pleine conscience et des ressources pour nourrir vos relations.
        </p>
        <form class="flex flex-col sm:flex-row gap-4" @submit.prevent="subscribe">
          <input
            v-model="email"
            type="email"
            placeholder="votre@courriel.com"
            :disabled="loading || success"
            class="flex-1 bg-tertiary-container text-on-tertiary rounded-xl px-6 py-4 outline-none placeholder-on-tertiary-container/60 focus:ring-2 focus:ring-secondary-fixed/50 disabled:opacity-50"
          />
          <button
            type="submit"
            :disabled="loading || success"
            class="bg-secondary-fixed text-on-secondary-container px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform whitespace-nowrap disabled:opacity-50 disabled:scale-100"
          >
            {{ success ? 'Inscrit ✓' : loading ? '...' : "S'abonner" }}
          </button>
        </form>
        <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
      </div>

      <!-- Right: blog cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6" data-animate>

        <NuxtLink
          v-for="post in posts"
          :key="post.slug"
          :to="`/blog/${post.slug}`"
          class="bg-tertiary-container rounded-2xl overflow-hidden group"
        >
          <div class="aspect-[4/3] overflow-hidden">
            <img
              :src="post.image"
              :alt="post.title"
              class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          </div>
          <div class="p-6">
            <span class="text-xs uppercase tracking-widest text-secondary-fixed-dim mb-3 block">Lecture {{ post.readTime }} min</span>
            <h4 class="font-headline text-xl text-on-tertiary">{{ post.title }}</h4>
          </div>
        </NuxtLink>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  posts: { slug: string; title: string; image: string; readTime: number }[]
}>()

const email = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function subscribe() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/newsletter/subscribe', { method: 'POST', body: { email: email.value } })
    success.value = true
    email.value = ''
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Une erreur est survenue. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>
