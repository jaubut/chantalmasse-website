<template>
  <div class="max-w-3xl mx-auto px-8 py-24">
    <h1 class="font-headline italic text-4xl text-primary mb-12">Infolettre et confidentialité</h1>

    <section v-for="s in sections" :key="s.title" class="mb-10">
      <h2 class="text-lg font-semibold uppercase tracking-wide text-primary mb-3">{{ s.title }}</h2>
      <p v-for="p in s.body" :key="p" class="text-on-surface-variant leading-relaxed mb-3">{{ p }}</p>
    </section>

    <p class="text-on-surface-variant leading-relaxed">
      Pour toute question ou pour exercer vos droits : <a href="mailto:chantal.gmasse@gmail.com" class="text-primary hover:underline">chantal.gmasse@gmail.com</a>.
      Voir aussi la <NuxtLink to="/confidentialite" class="text-primary hover:underline">politique de confidentialité</NuxtLink> du site.
    </p>
  </div>
</template>

<script setup lang="ts">
import { NEWSLETTER_CONSENT_TEXT } from '~/utils/newsletterConsent'

// DRAFT pending Chantal's approval (TASK f8fa4fb5): Law 25 notice for the newsletter.
const sections = [
  {
    title: 'Responsable',
    body: [
      'Chantal Massé, thérapeute en relation d’aide à Shefford, est responsable de la protection des renseignements personnels recueillis pour l’infolettre. Vous pouvez la joindre à chantal.gmasse@gmail.com.',
    ],
  },
  {
    title: 'Ce que nous recueillons',
    body: [
      'Votre adresse courriel. Nous ne demandons ni votre nom ni votre téléphone.',
      'Quand vous confirmez votre inscription, nous enregistrons aussi la preuve de votre consentement : la date et l’heure de la confirmation, le texte exact du consentement que vous avez accepté et l’adresse IP de l’appareil utilisé pour confirmer.',
      `Texte du consentement en vigueur : « ${NEWSLETTER_CONSENT_TEXT} »`,
    ],
  },
  {
    title: 'Pourquoi',
    body: [
      'Votre adresse sert uniquement à vous envoyer l’infolettre mensuelle (pistes de réflexion et ressources). La preuve de consentement sert à démontrer, au besoin, que vous avez accepté de la recevoir, comme l’exige la Loi canadienne anti-pourriel. Vos renseignements ne sont jamais vendus ni utilisés à d’autres fins.',
    ],
  },
  {
    title: 'Double confirmation',
    body: [
      'Après le formulaire, vous recevez un courriel avec un lien de confirmation valide 7 jours. Tant que vous n’avez pas confirmé, votre adresse n’est pas ajoutée à la liste et vous ne recevrez rien d’autre.',
    ],
  },
  {
    title: 'Fournisseurs de services',
    body: [
      'Les courriels sont envoyés par Resend (Resend, Inc.), qui agit comme sous-traitant et traite votre adresse courriel sur des serveurs situés aux États-Unis, donc à l’extérieur du Québec. La liste et la preuve de consentement sont conservées dans un système géré par Tech Lab Studio, le fournisseur technologique de Chantal Massé, sur des serveurs situés au Canada.',
    ],
  },
  {
    title: 'Conservation',
    body: [
      'Vos renseignements sont conservés tant que vous êtes abonné·e. Si vous vous désabonnez, nous gardons seulement votre adresse et la date du désabonnement, afin de ne plus jamais vous écrire. La preuve de consentement est conservée 3 ans après la fin de l’abonnement, puis supprimée.',
    ],
  },
  {
    title: 'Vous désabonner',
    body: [
      'Chaque infolettre contient un lien de désabonnement qui prend effet immédiatement. Vous pouvez aussi écrire à chantal.gmasse@gmail.com.',
    ],
  },
  {
    title: 'Vos droits',
    body: [
      'Vous pouvez demander l’accès à vos renseignements, leur rectification ou leur suppression, et retirer votre consentement en tout temps. Si vous n’êtes pas satisfait·e de notre réponse, vous pouvez vous adresser à la Commission d’accès à l’information du Québec.',
    ],
  },
]

useSeoMeta({
  title: 'Infolettre et confidentialité — Chantal Massé',
  description: 'Comment l’infolettre de Chantal Massé traite votre adresse courriel.',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://chantalmasse.com/confidentialite-infolettre' },
  ],
})
</script>
