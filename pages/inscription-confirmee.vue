<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-8">
    <div class="text-center max-w-lg">
      <div class="w-16 h-16 rounded-full bg-secondary-fixed flex items-center justify-center mx-auto mb-8">
        <Icon icon="material-symbols:check" class="text-3xl text-on-secondary-container" />
      </div>
      <h1 class="font-headline italic text-4xl text-primary mb-4">Merci pour votre inscription !</h1>
      <p class="text-on-surface-variant font-light leading-relaxed mb-8">
        Votre adresse courriel a bien été confirmée. Vous recevrez prochainement les réflexions et ressources de Chantal Massé directement dans votre boîte de réception.
      </p>
      <NuxtLink to="/" class="inline-block bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors">
        Retour à l'accueil
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

useSeoMeta({
  title: 'Inscription confirmée — Chantal Massé',
  ogTitle: 'Inscription confirmée — Chantal Massé',
  description: 'Merci pour votre inscription à l\'infolettre de Chantal Massé.',
  ogDescription: 'Merci pour votre inscription à l\'infolettre de Chantal Massé.',
  ogImage: 'https://chantalmasse.com/images/chantal-hero.jpg',
  ogType: 'website',
  robots: 'noindex',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://chantalmasse.com/inscription-confirmee' },
  ],
})
</script>
