<template>
  <div class="max-w-3xl mx-auto px-8 py-24">
    <h1 class="font-headline italic text-4xl text-primary mb-12">Politique de confidentialité</h1>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Collecte des données</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Ce site collecte uniquement les informations que vous fournissez volontairement via le formulaire de contact ou d'inscription à l'infolettre : nom, adresse courriel, et message. Aucune donnée n'est collectée sans votre consentement.
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Utilisation des données</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Les données collectées sont utilisées uniquement pour répondre à vos demandes de renseignements, confirmer vos rendez-vous, et vous envoyer l'infolettre si vous y avez souscrit. Elles ne sont jamais vendues ni partagées avec des tiers à des fins commerciales.
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Conservation des données</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Vos données sont conservées le temps nécessaire à la finalité pour laquelle elles ont été collectées, ou jusqu'à ce que vous demandiez leur suppression.
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Vos droits</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Conformément à la Loi 25 (Québec) et au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, contactez-nous à : <a href="mailto:contact@chantalmasse.com" class="text-primary hover:underline">contact@chantalmasse.com</a>.
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Cookies</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Ce site n'utilise pas de cookies publicitaires. Des cookies techniques peuvent être utilisés pour assurer le bon fonctionnement du site (analyses anonymes de trafic via Vercel Analytics).
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Confidentialité — Chantal Massé',
  ogTitle: 'Confidentialité — Chantal Massé',
  description: 'Politique de confidentialité du site de Chantal Massé, thérapeute.',
  ogDescription: 'Politique de confidentialité du site de Chantal Massé, thérapeute.',
  ogImage: 'https://chantalmasse.com/images/chantal-hero.jpg',
  ogType: 'website',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://chantalmasse.com/confidentialite' },
  ],
})
</script>
