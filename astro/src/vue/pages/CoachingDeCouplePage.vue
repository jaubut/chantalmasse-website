<template>
  <div class="min-h-screen bg-background">

    <!-- Hero — matches search intent immediately -->
    <section
      class="min-h-[85vh] flex items-center justify-center px-8 lg:px-20 pt-28 pb-16 bg-background"
      v-bind="tlsBlockAttrs(on, 'hero', 'hero')"
    >
      <div class="max-w-3xl mx-auto w-full flex flex-col items-center text-center gap-6">
        <span
          class="inline-flex items-center bg-secondary-fixed text-on-secondary-container text-xs uppercase tracking-widest rounded-full px-4 py-2"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'eyebrow')"
        >
          {{ cmsPage?.hero?.eyebrow || 'Coaching de couple — Shefford, en présentiel' }}
        </span>
        <h1
          class="font-headline text-4xl lg:text-6xl text-primary leading-[1.08] lg:leading-none tracking-tight"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'heading/0')"
        >
          <template v-if="cmsPage?.hero?.heading?.[0]">{{ cmsPage.hero.heading[0] }}</template>
          <template v-else>
            <span class="italic">Ce n'est pas un manque d'amour</span> qui sépare un couple, mais un manque d'outils.
          </template>
        </h1>
        <p
          class="text-on-surface-variant text-lg max-w-xl font-light"
          v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'lede')"
        >
          {{ cmsPage?.hero?.lede || "Le coaching de couple, c'est apprendre à communiquer autrement. 90 minutes de dialogue intentionnel pour transformer les conflits en connexion." }}
        </p>
        <div class="flex flex-col sm:flex-row gap-4 mt-2">
          <button
            class="bg-primary text-on-primary px-10 py-5 rounded-xl font-semibold text-center hover:bg-primary-container transition-colors"
            data-booking-open="couple"
            v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'cta/label')"
          >
            {{ cmsPage?.hero?.ctaLabel || 'Réserver une séance — 160$' }}
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
            <Icon icon="material-symbols:location-on" class="text-primary" />
            En personne, à Shefford
          </span>
        </div>
      </div>
    </section>

    <!-- Pain points — what brings couples here -->
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
          {{ cmsPage?.services?.intro || 'La plupart des couples qui me consultent vivent au moins une de ces situations.' }}
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
          >{{ cmsPage?.approche?.title || 'Le dialogue intentionnel Imago' }}</h2>
          <p
            class="text-on-surface-variant font-light text-lg mb-6"
            v-bind="tlsBlockFieldAttrs(on, docId, 'approche', 'body')"
          >
            {{ cmsPage?.approche?.body || "Le coaching est une approche orientée vers la solution. Au cours de chaque rencontre de 90 minutes, le couple est appelé à entrer en relation — se faire connaître l'un à l'autre — et non en réaction." }}
          </p>
          <ul class="space-y-4 mb-8">
            <li v-for="step in steps" :key="step" class="flex items-start gap-3">
              <Icon icon="material-symbols:check-circle" class="text-primary mt-0.5 shrink-0" />
              <span class="text-on-surface-variant font-light">{{ step }}</span>
            </li>
          </ul>
        </div>
        <div class="bg-primary p-12 rounded-[2.5rem]">
          <Icon icon="material-symbols:favorite" class="text-3xl text-on-primary mb-6" />
          <h3 class="font-headline text-2xl text-on-primary italic mb-4">Ce que vous repartez avec</h3>
          <ul class="space-y-4">
            <li v-for="outcome in outcomes" :key="outcome" class="flex items-start gap-3">
              <Icon icon="material-symbols:arrow-forward" class="text-on-primary mt-0.5 shrink-0" />
              <span class="text-on-primary-container font-light">{{ outcome }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Testimonials — couple only -->
    <section
      id="apropos"
      class="py-24 px-8 bg-surface-container-low"
      v-bind="tlsBlockAttrs(on, 'apropos', 'list')"
    >
      <div class="max-w-screen-xl mx-auto">
        <h2
          class="font-headline text-4xl text-primary italic text-center mb-16"
          v-bind="tlsBlockFieldAttrs(on, docId, 'apropos', 'title')"
        >{{ cmsPage?.apropos?.title || 'Ce que les couples en disent' }}</h2>
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
          <Icon icon="material-symbols:favorite" class="absolute top-0 right-0 text-primary opacity-5 select-none pointer-events-none" style="width: 18rem; height: 18rem; transform: translate(20%, -15%);" />

          <div
            class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10"
            v-bind="tlsCollectionAttrs(on, 'service')"
          >
            <div>
              <h2
                class="font-headline text-4xl italic text-primary mb-4"
                v-bind="tlsBlockFieldAttrs(on, docId, 'tarif', 'note')"
              >{{ cmsPage?.tarif?.note || 'Prêt à retrouver la complicité?' }}</h2>
              <p class="text-on-surface-variant font-light text-lg mb-8">
                La première séance est souvent la plus importante. C'est le moment où on établit un espace sécurisé pour le dialogue.
              </p>
              <button
                class="bg-primary text-on-primary px-12 py-6 rounded-2xl font-bold text-xl hover:scale-105 transition-transform"
                data-booking-open="couple"
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
              >{{ cmsPage?.service?.title || 'Coaching de couple' }}</h4>
              <div class="space-y-4 mb-8">
                <div class="flex justify-between py-3 border-b border-outline-variant/20">
                  <span class="text-on-surface">Durée</span>
                  <span
                    class="text-on-surface font-semibold"
                    v-bind="tlsExtFieldAttrs(on, serviceId, 'attrs/duration_minutes')"
                  >{{ cmsPage?.service?.durationMinutes != null ? `${cmsPage.service.durationMinutes} minutes` : '90 minutes' }}</span>
                </div>
                <div class="flex justify-between py-3 border-b border-outline-variant/20">
                  <span class="text-on-surface">Tarif</span>
                  <span
                    class="text-on-surface font-semibold"
                    v-bind="tlsExtFieldAttrs(on, serviceId, 'priceCents')"
                  >{{ cmsPage?.service?.priceCents != null ? `${Math.round(cmsPage.service.priceCents / 100)}$ / séance` : '160$ / séance' }}</span>
                </div>
                <div class="flex justify-between py-3 border-b border-outline-variant/20">
                  <span class="text-on-surface">Format</span>
                  <span class="text-on-surface-variant font-light">En personne, à Shefford</span>
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

export interface CmsCouplePageData {
  docId?: string
  hero?: {
    eyebrow?: string
    heading?: [string, string?]
    lede?: string
    ctaLabel?: string
  }
  services?: {
    title?: string
    intro?: string
    items?: Array<{ title?: string; body?: string }>
  }
  approche?: {
    title?: string
    body?: string
  }
  apropos?: {
    title?: string
    items?: Array<{ title?: string; subtitle?: string; body?: string }>
  }
  tarif?: {
    note?: string
    label?: string
  }
  service?: {
    id?: string
    title?: string
    durationMinutes?: number | null
    priceCents?: number | null
  }
}

const props = defineProps<{
  previewMode?: boolean
  cmsPage?: CmsCouplePageData
  cmsSettings?: { id?: string; address?: string }
}>()

const on = computed(() => Boolean(props.previewMode))
const docId = computed(() => props.cmsPage?.docId || pageDocId('coaching-de-couple'))
const serviceId = computed(() => props.cmsPage?.service?.id || serviceDocId('coaching-de-couple'))
const settingsId = computed(() => props.cmsSettings?.id || settingsDocId())

const DEFAULT_PAIN_POINTS = [
  {
    icon: 'material-symbols:replay',
    title: 'Les mêmes conflits reviennent',
    desc: 'Vous avez l\'impression de tourner en rond. Les discussions finissent toujours de la même façon, sans résolution.',
  },
  {
    icon: 'material-symbols:volume-off',
    title: 'La communication est brisée',
    desc: 'Vous n\'arrivez plus à vous parler sans que ça dégénère. Le silence s\'installe ou l\'un des deux explose.',
  },
  {
    icon: 'material-symbols:distance',
    title: 'La distance s\'est installée',
    desc: 'Vous vivez côte à côte mais plus ensemble. La complicité a fait place à la routine ou à l\'indifférence.',
  },
  {
    icon: 'material-symbols:heart-broken',
    title: 'Une blessure n\'a pas guéri',
    desc: 'Infidélité, trahison de confiance, mensonge. Vous voulez avancer mais le passé revient sans cesse.',
  },
  {
    icon: 'material-symbols:family-restroom',
    title: 'La parentalité crée des tensions',
    desc: 'Les enfants, les responsabilités, la fatigue — le couple disparaît derrière les rôles de parents.',
  },
  {
    icon: 'material-symbols:help',
    title: 'Vous hésitez à consulter',
    desc: 'Vous ne savez pas si c\'est "assez grave" pour consulter. Spoiler : il n\'y a pas de seuil minimum.',
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
  'Un espace sans jugement où chacun peut s\'exprimer en toute sécurité',
  'Des outils de communication concrets que vous utilisez dès la première séance',
  'Un accompagnement qui transforme la réaction en relation',
  'Des actions concrètes à mettre en place entre les séances',
]

const outcomes = [
  'Une meilleure compréhension des besoins de l\'autre',
  'Des outils pour communiquer sans attaquer ni fuir',
  'La capacité de transformer un conflit en opportunité de rapprochement',
  'Un plan d\'action concret pour retrouver la complicité au quotidien',
]

const DEFAULT_COUPLE_TESTIMONIALS = [
  {
    quote: 'Nous avons beaucoup apprécié les séances de coaching de couple avec Chantal, car elle sait très bien établir une ambiance propice aux échanges. La communication se fait sans jugement et dans le respect. Son approche permet également de créer des ponts qui favorisent l\'ouverture, la compréhension et l\'acceptation. Nous recommandons sans réserve Chantal à tous ceux qui veulent réellement améliorer leur relation de couple.',
    name: 'Véronique & Dany',
    context: 'En thérapie de couple',
  },
  {
    quote: 'Chantal nous a aidé à avoir un but de couple tout en ayant des trucs pour les atteindre. Elle nous a appris à communiquer de façon efficace tout en restant dans le respect de l\'autre et a se concentrer sur le NOUS…couple. Être focus sur le positif et ce que l\'on aime de l\'autre tout en restant fixé sur le nous. Elle nous guide dans nos moments plus difficile.',
    name: 'Suzy et Jocelyn',
    context: 'En coaching de couple',
  },
]

const resolvedTestimonials = computed(() => {
  const items = props.cmsPage?.apropos?.items
  if (!items || items.length === 0) return DEFAULT_COUPLE_TESTIMONIALS
  return items.map((it, i) => {
    const fb = DEFAULT_COUPLE_TESTIMONIALS[i]
    return {
      quote: it.body?.trim() || fb?.quote || '',
      name: it.title?.trim() || fb?.name || '',
      context: it.subtitle?.trim() || fb?.context || '',
    }
  }).filter(t => t.quote && t.name)
})
</script>
