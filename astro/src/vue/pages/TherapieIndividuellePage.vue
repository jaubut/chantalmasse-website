<template>
  <div class="min-h-screen bg-background">

    <!-- Hero -->
    <section
      class="min-h-[85vh] flex items-center justify-center px-8 lg:px-20 pt-28 pb-16 bg-background"
      v-bind="tlsBlockAttrs(on, 'hero', 'hero')"
    >
      <div class="max-w-3xl mx-auto w-full flex flex-col items-center text-center gap-6">
        <span
          class="inline-flex items-center bg-primary-fixed text-on-secondary-container text-xs uppercase tracking-widest rounded-full px-4 py-2"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'eyebrow')"
        >
          {{ cmsPage?.hero?.eyebrow || 'Thérapie individuelle — Shefford & vidéoconférence' }}
        </span>
        <h1
          class="font-headline text-4xl lg:text-6xl text-primary leading-[1.08] lg:leading-none tracking-tight"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'heading/0')"
        >
          <template v-if="cmsPage?.hero?.heading?.[0]">{{ cmsPage.hero.heading[0] }}</template>
          <template v-else>
            Tu as de la <span class="italic">valeur</span> — ne laisse pas ta souffrance te définir.
          </template>
        </h1>
        <p
          class="text-on-surface-variant text-lg max-w-xl font-light"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'lede')"
        >
          {{ cmsPage?.hero?.lede || 'Un espace sécurisé pour explorer ce qui te fait mal, comprendre tes patterns et reprendre confiance en toi. 60 minutes pour soi, à ton rythme.' }}
        </p>
        <div class="flex flex-col sm:flex-row gap-4 mt-2">
          <button
            class="bg-primary text-on-primary px-10 py-5 rounded-xl font-semibold text-center hover:bg-primary-container transition-colors"
            data-booking-open="individual"
            v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'cta/label')"
          >
            {{ cmsPage?.hero?.ctaLabel || 'Réserver une séance — 105$' }}
          </button>
          <a href="#approche" class="border border-outline-variant/40 px-10 py-5 rounded-xl text-center hover:bg-surface-container transition-colors font-light" style="background-color: rgba(254,248,243,0.4);">
            Comment ça fonctionne?
          </a>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-6 mt-2 text-sm text-on-surface-variant">
          <span class="flex items-center gap-1.5">
            <Icon icon="material-symbols:verified" class="text-primary" />
            Membre RITMA — reçus d'assurance
          </span>
          <span class="flex items-center gap-1.5">
            <Icon icon="material-symbols:videocam" class="text-primary" />
            En personne ou vidéo
          </span>
        </div>
      </div>
    </section>

    <!-- Pain points -->
    <section
      id="services"
      class="py-24 px-8 bg-surface-container-low"
      v-bind="tlsBlockAttrs(on, 'services', 'list')"
    >
      <div class="max-w-screen-xl mx-auto">
        <h2
          class="font-headline text-4xl text-primary italic text-center mb-4"
          v-bind="tlsBlockFieldAttrs(on, docId, 'services', 'title')"
        >{{ cmsPage?.services?.title || 'Tu te reconnais?' }}</h2>
        <p
          class="text-center text-on-surface-variant font-light max-w-xl mx-auto mb-16"
          v-bind="tlsBlockFieldAttrs(on, docId, 'services', 'intro')"
        >
          {{ cmsPage?.services?.intro || 'La plupart des personnes qui me consultent vivent au moins une de ces situations.' }}
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(pain, i) in resolvedPainPoints"
            :key="`${pain.title}-${i}`"
            class="bg-surface-container-lowest p-8 rounded-2xl"
          >
            <Icon :icon="pain.icon" class="text-2xl text-primary mb-4" />
            <h3
              class="font-semibold text-on-surface mb-2"
              v-bind="tlsBlockFieldAttrs(on, docId, 'services', `items/${i}/title`)"
            >{{ pain.title }}</h3>
            <p
              class="text-on-surface-variant font-light text-sm leading-relaxed"
              v-bind="tlsBlockFieldAttrs(on, docId, 'services', `items/${i}/body`)"
            >{{ pain.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Approach -->
    <section
      id="approche"
      class="py-24 px-8 bg-background"
      v-bind="tlsBlockAttrs(on, 'approche', 'rich_text')"
    >
      <div class="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2
            class="font-headline text-4xl text-primary italic mb-6"
            v-bind="tlsBlockFieldAttrs(on, docId, 'approche', 'title')"
          >{{ cmsPage?.approche?.title || 'Une approche centrée sur toi' }}</h2>
          <p
            class="text-on-surface-variant font-light text-lg mb-6"
            v-bind="tlsBlockFieldAttrs(on, docId, 'approche', 'body')"
          >
            {{ cmsPage?.approche?.body || "La thérapie en relation d'aide te permet de prendre conscience de ce qui se passe en toi — ce qui entretient tes insatisfactions, tes peurs, tes douleurs — et de cheminer vers un mieux-être, à ton propre rythme." }}
          </p>
          <ul class="space-y-4 mb-8">
            <li v-for="step in steps" :key="step" class="flex items-start gap-3">
              <Icon icon="material-symbols:check-circle" class="text-primary mt-0.5 shrink-0" />
              <span class="text-on-surface-variant font-light">{{ step }}</span>
            </li>
          </ul>
        </div>
        <div class="bg-primary p-12 rounded-[2.5rem]">
          <Icon icon="material-symbols:person" class="text-3xl text-on-primary mb-6" />
          <h3 class="font-headline text-2xl text-on-primary italic mb-4">Ce que tu repartiras avec</h3>
          <ul class="space-y-4">
            <li v-for="outcome in outcomes" :key="outcome" class="flex items-start gap-3">
              <Icon icon="material-symbols:arrow-forward" class="text-on-primary mt-0.5 shrink-0" />
              <span class="text-on-primary-container font-light">{{ outcome }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Testimonials — individual only -->
    <section
      id="apropos"
      class="py-24 px-8 bg-surface-container-low"
      v-bind="tlsBlockAttrs(on, 'apropos', 'list')"
    >
      <div class="max-w-screen-xl mx-auto">
        <h2
          class="font-headline text-4xl text-primary italic text-center mb-16"
          v-bind="tlsBlockFieldAttrs(on, docId, 'apropos', 'title')"
        >{{ cmsPage?.apropos?.title || "Ce qu'elles en disent" }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div
            v-for="(t, i) in resolvedTestimonials"
            :key="`${t.name}-${i}`"
            class="bg-surface-container-lowest p-10 rounded-[2rem]"
          >
            <p class="font-headline text-4xl text-primary-fixed-dim leading-none mb-4">"</p>
            <p
              class="text-on-surface leading-relaxed mb-6"
              v-bind="tlsBlockFieldAttrs(on, docId, 'apropos', `items/${i}/body`)"
            >{{ t.quote }}</p>
            <p
              class="font-semibold text-primary"
              v-bind="tlsBlockFieldAttrs(on, docId, 'apropos', `items/${i}/title`)"
            >{{ t.name }}</p>
            <p
              class="text-sm text-on-surface-variant font-light"
              v-bind="tlsBlockFieldAttrs(on, docId, 'apropos', `items/${i}/subtitle`)"
            >{{ t.context }}</p>
          </div>
        </div>
        <div class="text-center mt-10">
          <a
            href="https://search.google.com/local/writereview?placeid=ChIJf0hxfazRyUwRzgp46r7fzIQ"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-sm"
          >
            <span>★</span> Voir tous nos avis Google
          </a>
        </div>
      </div>
    </section>

    <!-- Pricing + CTA -->
    <section
      class="py-24 px-8 bg-background"
      v-bind="tlsBlockAttrs(on, 'tarif', 'cta')"
    >
      <div class="max-w-screen-xl mx-auto">
        <div class="bg-surface-container-low rounded-[3rem] p-8 lg:p-20 relative overflow-hidden">
          <Icon icon="material-symbols:eco" class="absolute top-0 right-0 text-primary opacity-5 select-none pointer-events-none" style="width: 18rem; height: 18rem; transform: translate(20%, -15%);" />

          <div
            class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10"
            v-bind="tlsCollectionAttrs(on, 'service')"
          >
            <div>
              <h2
                class="font-headline text-4xl italic text-primary mb-4"
                v-bind="tlsBlockFieldAttrs(on, docId, 'tarif', 'note')"
              >{{ cmsPage?.tarif?.note || 'Prêt à prendre soin de toi?' }}</h2>
              <p class="text-on-surface-variant font-light text-lg mb-8">
                La première séance, c'est avant tout un espace pour être entendu. Sans jugement, sans pression. On commence là où tu en es.
              </p>
              <button
                class="bg-primary text-on-primary px-12 py-6 rounded-2xl font-bold text-xl hover:scale-105 transition-transform"
                data-booking-open="individual"
                v-bind="tlsBlockFieldAttrs(on, docId, 'tarif', 'label')"
              >
                {{ cmsPage?.tarif?.label || 'Réserver une séance' }}
              </button>
            </div>

            <div
              class="bg-surface p-10 rounded-[2rem] editorial-shadow"
              v-bind="tlsItemAttrs(on, serviceId, 'service')"
            >
              <h4
                class="font-headline text-2xl italic text-primary mb-6"
                v-bind="tlsEntryFieldAttrs(on, serviceId, 'title')"
              >{{ cmsPage?.service?.title || 'Thérapie individuelle' }}</h4>
              <div class="space-y-4 mb-8">
                <div class="flex justify-between py-3 border-b border-outline-variant/20">
                  <span class="text-on-surface">Durée</span>
                  <span
                    class="text-on-surface font-semibold"
                    v-bind="tlsExtFieldAttrs(on, serviceId, 'attrs/duration_minutes')"
                  >{{ cmsPage?.service?.durationMinutes != null ? `${cmsPage.service.durationMinutes} minutes` : '60 minutes' }}</span>
                </div>
                <div class="flex justify-between py-3 border-b border-outline-variant/20">
                  <span class="text-on-surface">Tarif</span>
                  <span
                    class="text-on-surface font-semibold"
                    v-bind="tlsExtFieldAttrs(on, serviceId, 'priceCents')"
                  >{{ cmsPage?.service?.priceCents != null ? `${Math.round(cmsPage.service.priceCents / 100)}$ / séance` : '105$ / séance' }}</span>
                </div>
                <div class="flex justify-between py-3 border-b border-outline-variant/20">
                  <span class="text-on-surface">Format</span>
                  <span class="text-on-surface-variant font-light">En personne ou vidéo</span>
                </div>
                <div class="flex justify-between py-3">
                  <span class="text-on-surface">Assurance</span>
                  <span class="text-on-surface-variant font-light">Reçus RITMA disponibles</span>
                </div>
              </div>
              <div class="flex items-start gap-3 text-sm text-on-surface-variant">
                <Icon icon="material-symbols:location-on" class="text-primary mt-0.5 shrink-0" />
                <span v-bind="tlsSettingsFieldAttrs(on, settingsId, 'address')">{{ cmsSettings?.address || '245 rue Colette, Shefford, QC J2M 2B7' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Minimal footer -->
    <footer class="py-10 px-8 text-center" style="background-color: #f8f3ee;">
      <p class="text-[11px] uppercase tracking-wide" style="color: rgba(23,48,40,0.35);">
        © 2026 Chantal Massé — Thérapeute en relation d'aide, Shefford, QC
      </p>
    </footer>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../Icon.vue'
import {
  pageDocId,
  serviceDocId,
  settingsDocId,
  tlsBlockAttrs,
  tlsBlockFieldAttrs,
  tlsCollectionAttrs,
  tlsEntryFieldAttrs,
  tlsExtFieldAttrs,
  tlsItemAttrs,
  tlsSettingsFieldAttrs,
} from '../../lib/tls-edit-attrs'
import type { CmsCouplePageData } from './CoachingDeCouplePage.vue'

const props = defineProps<{
  previewMode?: boolean
  cmsPage?: CmsCouplePageData
  cmsSettings?: { id?: string; address?: string }
}>()

const on = computed(() => Boolean(props.previewMode))
const docId = computed(() => props.cmsPage?.docId || pageDocId('therapie-individuelle'))
const serviceId = computed(() => props.cmsPage?.service?.id || serviceDocId('therapie-individuelle'))
const settingsId = computed(() => props.cmsSettings?.id || settingsDocId())

const DEFAULT_PAIN_POINTS = [
  {
    icon: 'material-symbols:mood-bad',
    title: 'L\'anxiété te paralyse',
    desc: 'Les pensées tournent en boucle. Tu as du mal à dormir, à te concentrer, à profiter du moment présent.',
  },
  {
    icon: 'material-symbols:sentiment-dissatisfied',
    title: 'Tu te sens vide ou épuisé',
    desc: 'La fatigue n\'est pas que physique. Tu fonctionnes en mode automatique sans savoir pourquoi tu n\'es plus bien.',
  },
  {
    icon: 'material-symbols:replay',
    title: 'Les mêmes patterns se répètent',
    desc: 'Dans tes relations, au travail, dans ta vie — tu retombes toujours dans les mêmes schémas sans comprendre pourquoi.',
  },
  {
    icon: 'material-symbols:thunderstorm',
    title: 'Une épreuve t\'a secoué',
    desc: 'Deuil, séparation, perte d\'emploi, trahison. Tu as besoin d\'un espace pour déposer ce que tu portes.',
  },
  {
    icon: 'material-symbols:shield-person',
    title: 'Tu as du mal à poser tes limites',
    desc: 'Tu dis oui quand tu veux dire non. Tu t\'oublies pour les autres et tu finis par en vouloir à tout le monde.',
  },
  {
    icon: 'material-symbols:help',
    title: 'Tu ne sais pas par où commencer',
    desc: 'Tu sais que quelque chose ne va pas, mais tu n\'arrives pas à mettre le doigt dessus. C\'est correct — on commence là.',
  },
]

const resolvedPainPoints = computed(() => {
  const items = props.cmsPage?.services?.items
  if (!items || items.length === 0) return DEFAULT_PAIN_POINTS
  return DEFAULT_PAIN_POINTS.map((fb, i) => ({
    icon: fb.icon,
    title: items[i]?.title?.trim() || fb.title,
    desc: items[i]?.body?.trim() || fb.desc,
  }))
})

const steps = [
  'Un espace sans jugement où tu peux t\'exprimer en toute sécurité',
  'Une écoute active qui t\'aide à comprendre ce qui se passe en toi',
  'Des outils concrets pour mieux te connaître et faire des choix conscients',
  'Un accompagnement à ton rythme — pas de pression, pas de recette magique',
]

const outcomes = [
  'Une meilleure connaissance de toi-même et de tes patterns',
  'La capacité de poser tes limites avec confiance',
  'Des outils pour gérer l\'anxiété et les moments difficiles',
  'Un regard plus doux envers toi-même et ta propre valeur',
]

const DEFAULT_INDIVIDUAL_TESTIMONIALS = [
  {
    quote: 'Les moments partagés avec Chantal ont été simplement bénissant. Elle m\'a doucement guider dans mes réflexions et m\'a aidé à travailler sur moi-même. J\'ai pu, grâce à nos rencontres, apprendre enfin, à mieux me connaître, à m\'aimer et enfin mettre mes limites. Douce, empathique, à l\'écoute Chantal sait nous accompagné dans un respect des plus complet.',
    name: 'Alexandra',
    context: 'En thérapie individuelle',
  },
  {
    quote: 'Suite à certains problèmes dans ma vie, j\'ai contacté Chantal pour m\'aider à y voir plus clair. Tout de suite j\'ai vu une différence. Je réussissais de plus en plus à analyser la situation par moi-même grâce aux outils qu\'elle m\'apportait. J\'ai appris à prendre soin de moi, à accepter mes limites et à mieux accepter mes rechutes. Avec Chantal, c\'est simple et facile de parler. Elle va à notre rythme tout en nous amenant plus loin dans notre vie. Je vous la recommande à 100%.',
    name: 'Myriam',
    context: 'En thérapie individuelle',
  },
]

const resolvedTestimonials = computed(() => {
  const items = props.cmsPage?.apropos?.items
  if (!items || items.length === 0) return DEFAULT_INDIVIDUAL_TESTIMONIALS
  return items.map((it, i) => {
    const fb = DEFAULT_INDIVIDUAL_TESTIMONIALS[i]
    return {
      quote: it.body?.trim() || fb?.quote || '',
      name: it.title?.trim() || fb?.name || '',
      context: it.subtitle?.trim() || fb?.context || '',
    }
  }).filter(t => t.quote && t.name)
})
</script>
