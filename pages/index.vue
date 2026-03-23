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
</script>
