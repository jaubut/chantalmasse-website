<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-8 bg-background">
    <p class="text-on-surface-variant text-sm uppercase tracking-widest mb-6">{{ error?.statusCode || 404 }}</p>
    <h1 class="font-headline italic text-4xl lg:text-6xl text-primary leading-tight tracking-tight text-center mb-4">
      Cette page n'existe pas
    </h1>
    <p class="text-on-surface-variant text-lg font-light text-center max-w-md mb-12">
      La page que tu cherches a peut-être été déplacée ou n'existe plus.
    </p>
    <a
      href="/"
      class="bg-primary text-on-primary px-10 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors"
    >
      Retour à l'accueil
    </a>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()

useSeoMeta({
  title: 'Page introuvable — Chantal Massé',
  robots: 'noindex',
})
</script>
