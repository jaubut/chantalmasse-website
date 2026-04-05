<template>
  <div>
    <EmotionalJourney />
  </div>
</template>

<script setup lang="ts">
useScrollAnimation()

useSeoMeta({
  title: 'Le parcours émotionnel — Chantal Massé',
  ogTitle: 'Le parcours émotionnel — Chantal Massé',
  description: 'Une expérience immersive pour comprendre le chemin thérapeutique — de la souffrance vers la paix.',
  ogDescription: 'Une expérience immersive pour comprendre le chemin thérapeutique — de la souffrance vers la paix.',
  ogImage: 'https://chantalmasse.com/images/chantal-hero.jpg',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://chantalmasse.com/journey' },
  ],
})
</script>
