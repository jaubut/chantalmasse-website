<template>
  <div class="max-w-3xl mx-auto px-8 py-24">
    <h1 class="font-headline italic text-4xl text-primary mb-12">Mentions Légales</h1>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Éditeur du site</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Chantal Massé, thérapeute<br>
        Montréal, Québec, Canada<br>
        Courriel : <a href="mailto:contact@chantalmasse.com" class="text-primary hover:underline">contact@chantalmasse.com</a>
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Hébergement</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Ce site est hébergé par Vercel Inc., 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis.
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Propriété intellectuelle</h2>
      <p class="text-on-surface-variant leading-relaxed">
        L'ensemble du contenu de ce site (textes, images, graphismes) est la propriété exclusive de Chantal Massé, sauf mention contraire. Toute reproduction, distribution ou utilisation sans autorisation écrite préalable est interdite.
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Responsabilité</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Les informations publiées sur ce site sont fournies à titre indicatif. Elles ne constituent pas un avis médical ou thérapeutique et ne remplacent pas une consultation professionnelle. Chantal Massé ne saurait être tenue responsable de tout dommage découlant de l'utilisation de ces informations.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Mentions Légales — Chantal Massé',
  ogTitle: 'Mentions Légales — Chantal Massé',
  description: 'Mentions légales du site de Chantal Massé, thérapeute.',
  ogDescription: 'Mentions légales du site de Chantal Massé, thérapeute.',
  ogImage: 'https://chantalmasse.com/images/chantal-hero.jpg',
  ogType: 'website',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://chantalmasse.com/mentions-legales' },
  ],
})
</script>
