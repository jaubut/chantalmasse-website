<template>
  <div class="max-w-3xl mx-auto px-8 py-24">
    <h1 class="font-headline italic text-4xl text-primary mb-12">Politique de confidentialité</h1>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Collecte des données</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Ce site collecte les informations que vous fournissez volontairement via les formulaires de contact, de prise de rendez-vous ou d'inscription à l'infolettre (nom, adresse courriel, téléphone, message). Il collecte aussi automatiquement des données de navigation (pages consultées, type d'appareil et de navigateur, adresse IP, provenance de la visite) au moyen des outils de mesure et de publicité décrits dans la section « Témoins (cookies) et outils de suivi » ci-dessous.
      </p>
    </section>

    <section class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Utilisation des données</h2>
      <p class="text-on-surface-variant leading-relaxed">
        Les données collectées sont utilisées uniquement pour répondre à vos demandes de renseignements, confirmer vos rendez-vous, et vous envoyer l'infolettre si vous y avez souscrit. Les données de navigation servent à mesurer la fréquentation du site et l'efficacité de nos publicités. Vos données ne sont jamais vendues. Elles sont toutefois communiquées aux fournisseurs de services décrits ci-dessous (notamment Google et Meta), dont les serveurs peuvent être situés à l'extérieur du Québec, notamment aux États-Unis.
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
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">Témoins (cookies) et outils de suivi</h2>
      <p class="text-on-surface-variant leading-relaxed mb-4">
        Ce site utilise des témoins publicitaires et de mesure d'audience. Les outils suivants sont chargés lors de votre visite :
      </p>
      <ul class="list-disc pl-6 space-y-3 text-on-surface-variant leading-relaxed">
        <li>
          <strong>Google Analytics 4</strong> (Google LLC) — mesure d'audience : pages consultées, durée des visites, provenance du trafic. Dépose les témoins <code>_ga</code> et <code>_ga_*</code>.
        </li>
        <li>
          <strong>Pixel Meta</strong> (Meta Platforms, Facebook/Instagram) — mesure et ciblage publicitaire : pages consultées et actions réalisées sur le site (p. ex. prise de rendez-vous). Dépose les témoins publicitaires <code>_fbp</code> et, si vous arrivez d'une publicité, <code>_fbc</code>.
        </li>
        <li>
          <strong>API Conversions de Meta</strong> — lorsque vous réservez un rendez-vous, nos serveurs transmettent à Meta un événement de réservation contenant votre adresse courriel, votre téléphone, votre prénom et votre nom sous forme chiffrée (hachage SHA-256), ainsi que votre adresse IP, votre navigateur, les identifiants des témoins Meta ci-dessus, le service choisi et son prix. Le contenu de votre message et les détails de votre démarche ne sont jamais transmis.
        </li>
        <li>
          <strong>PostHog</strong> — analyse d'utilisation et enregistrement de session anonymisé. Aucun témoin n'est déposé (données conservées en mémoire seulement) et tous les champs de formulaire sont masqués.
        </li>
      </ul>
      <p class="text-on-surface-variant leading-relaxed mt-4">
        Vous pouvez bloquer ou supprimer ces témoins dans les paramètres de votre navigateur, installer le <a href="https://tools.google.com/dlpage/gaoptout?hl=fr" class="text-primary hover:underline" target="_blank" rel="noopener">module de désactivation de Google Analytics</a>, ou gérer vos <a href="https://www.facebook.com/adpreferences" class="text-primary hover:underline" target="_blank" rel="noopener">préférences publicitaires Meta</a>. Pour toute question, écrivez-nous à l'adresse indiquée ci-dessus.
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
  twitterCard: 'summary_large_image',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://chantalmasse.com/confidentialite' },
  ],
})
</script>
