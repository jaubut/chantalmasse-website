<template>
  <div>
    <HeroSection />
    <ServicesSection />
    <PhilosophySection />
    <MethodsSection />
    <TestimonialsSection />
    <NewsletterSection :posts="latestPosts ?? []" />
    <BookingSection />
  </div>
</template>

<script setup lang="ts">
useScrollAnimation()

const latestPosts = await queryCollection('blog').order('date', 'DESC').limit(2).all()

const siteUrl = 'https://chantalmasse.com'

useSeoMeta({
  title: 'Chantal Massé — Thérapeute en relation d\'aide à Shefford',
  ogTitle: 'Chantal Massé — Thérapeute en relation d\'aide à Shefford',
  description: 'Thérapie individuelle et coaching de couple à Shefford (Haute-Yamaska) et en vidéoconférence. Accompagnement bienveillant pour retrouver équilibre et sérénité.',
  ogDescription: 'Thérapie individuelle et coaching de couple à Shefford (Haute-Yamaska) et en vidéoconférence. Accompagnement bienveillant pour retrouver équilibre et sérénité.',
  ogImage: `${siteUrl}/images/chantal-hero.jpg`,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

useHead({
  link: [
    { rel: 'canonical', href: siteUrl },
  ],
})
</script>
