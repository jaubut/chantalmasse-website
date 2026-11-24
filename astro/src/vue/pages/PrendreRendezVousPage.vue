<template>
  <div class="bg-background text-on-surface font-body">
    <!-- ── HERO ──────────────────────────────────────────────────────────── -->
    <section
      ref="heroEl"
      data-lp-hero
      class="relative px-6 pt-24 pb-16 md:pt-32 md:pb-24"
      v-bind="tlsBlockAttrs(on, 'hero', 'hero')"
    >
      <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">

        <!-- Portrait — order-2 on mobile, order-1 (left) on md+ -->
        <div class="order-2 md:order-1">
          <div class="aspect-[4/5] max-w-md mx-auto md:mx-0 rounded-[2rem] overflow-hidden">
            <img
              :src="heroImageSrc"
              sizes="(max-width: 767px) 137vw, 615px"
              :srcset="heroImageSrcset"
              :alt="heroImageAlt"
              class="w-full h-full object-cover"
              loading="eager"
              fetchpriority="high"
              v-bind="tlsBlockImageAttrs(on, docId, 'hero', 'image')"
            />
          </div>
        </div>

        <!-- Text + CTA -->
        <div class="order-1 md:order-2">
          <!-- Trust pill -->
          <span
            class="inline-flex items-center bg-secondary-fixed text-on-secondary-container text-[11px] uppercase tracking-widest rounded-full px-4 py-2 mb-8"
            v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'eyebrow')"
          >
            {{ cmsPage?.hero?.eyebrow || '13 ans de pratique · Shefford & en vidéo' }}
          </span>

          <!-- H1 -->
          <h1
            class="font-headline italic text-primary leading-[1.05] sm:leading-none text-[2.5rem] sm:text-5xl md:text-5xl lg:text-6xl tracking-tight mb-6"
            v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'heading/0')"
          >
            {{ cmsPage?.hero?.heading?.[0] || 'Réserve ta séance avec Chantal, en moins de 2 minutes.' }}
          </h1>

          <!-- Subtitle -->
          <p
            class="text-lg md:text-xl text-on-surface-variant leading-relaxed md:leading-7 max-w-xl mb-10"
            v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'lede')"
          >
            {{ cmsPage?.hero?.lede || "Thérapeute en relation d'aide à Shefford et en vidéoconférence partout au Québec. Disponibilités dans les 7 à 14 jours." }}
          </p>

          <!-- Service switcher -->
          <div class="mb-6">
            <p class="font-mono text-[11px] uppercase tracking-[0.12em] text-on-surface-variant mb-3">
              Pour quel type de séance?
            </p>
            <div class="grid grid-cols-2 gap-2 max-w-md">
              <button
                v-for="opt in SERVICE_OPTIONS"
                :key="opt.id"
                type="button"
                :class="[
                  'px-5 py-3.5 rounded-xl border text-sm font-semibold transition-all duration-200',
                  selectedService === opt.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-primary border-outline-variant hover:border-primary',
                ]"
                @click="selectedService = opt.id"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Primary CTA -->
          <button
            class="w-full sm:w-auto bg-primary text-on-primary px-10 py-5 rounded-xl font-semibold text-base hover:bg-primary-container transition-colors"
            v-bind="tlsBlockFieldAttrs(on, docId, 'hero', 'cta/label')"
            @click="openBooking('hero')"
          >
            {{ cmsPage?.hero?.ctaLabel || 'Prendre rendez-vous' }}
          </button>

        </div>

      </div>
    </section>

    <!-- ── CE QUI T'ATTEND (3 steps) ───────────────────────────────────── -->
    <section
      class="px-6 py-16 md:py-24 bg-surface-container-low"
      v-bind="tlsBlockAttrs(on, 'etapes', 'list')"
    >
      <div class="max-w-3xl mx-auto">
        <h2
          class="font-headline text-primary text-3xl md:text-4xl mb-10 md:mb-14"
          v-bind="tlsBlockFieldAttrs(on, docId, 'etapes', 'title')"
        >
          {{ cmsPage?.etapes?.title || "Ce qui t'attend" }}
        </h2>
        <ol class="space-y-8 md:space-y-10">
          <li
            v-for="(step, i) in resolvedSteps"
            :key="i"
            class="flex gap-5 md:gap-7"
          >
            <span
              class="shrink-0 w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-headline italic text-lg"
            >
              {{ i + 1 }}
            </span>
            <div>
              <p
                class="font-semibold text-primary text-lg mb-1"
                v-bind="tlsBlockFieldAttrs(on, docId, 'etapes', `items/${i}/title`)"
              >{{ step.title }}</p>
              <p
                class="text-on-surface-variant leading-relaxed"
                v-bind="tlsBlockFieldAttrs(on, docId, 'etapes', `items/${i}/body`)"
              >{{ step.body }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- ── TESTIMONIALS ────────────────────────────────────────────────── -->
    <section
      class="px-6 py-16 md:py-24"
      v-bind="tlsBlockAttrs(on, 'temoignages', 'list')"
    >
      <div class="max-w-3xl mx-auto">
        <h2
          class="font-headline text-primary italic text-3xl md:text-4xl mb-10 md:mb-14"
          v-bind="tlsBlockFieldAttrs(on, docId, 'temoignages', 'title')"
        >
          {{ cmsPage?.temoignages?.title || 'Ce que les autres disent.' }}
        </h2>
        <div
          class="relative"
          @mouseenter="pauseCarousel = true"
          @mouseleave="pauseCarousel = false"
        >
          <!-- Track -->
          <div class="overflow-hidden">
            <div
              class="flex transition-transform duration-500 ease-out"
              :style="{ transform: `translateX(-${activeTestimonial * 100}%)` }"
            >
              <figure
                v-for="(t, i) in resolvedTestimonials"
                :key="`${t.name}-${i}`"
                class="shrink-0 w-full px-1"
              >
                <div class="bg-surface-container-low p-8 md:p-10 rounded-[2rem] editorial-shadow">
                  <p class="font-headline text-4xl text-primary-fixed-dim leading-none mb-4">"</p>
                  <blockquote
                    class="text-on-surface text-[17px] leading-relaxed mb-6 min-h-[9rem]"
                    v-bind="tlsBlockFieldAttrs(on, docId, 'temoignages', `items/${i}/body`)"
                  >
                    {{ t.quote }}
                  </blockquote>
                  <figcaption>
                    <p
                      class="font-semibold text-primary"
                      v-bind="tlsBlockFieldAttrs(on, docId, 'temoignages', `items/${i}/title`)"
                    >{{ t.name }}</p>
                    <p
                      class="text-sm text-on-surface-variant font-light"
                      v-bind="tlsBlockFieldAttrs(on, docId, 'temoignages', `items/${i}/subtitle`)"
                    >{{ t.context }}</p>
                  </figcaption>
                </div>
              </figure>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex items-center justify-between mt-6">
            <button
              type="button"
              aria-label="Témoignage précédent"
              class="w-10 h-10 rounded-full border border-outline-variant text-primary flex items-center justify-center hover:bg-surface-container transition-colors"
              @click="prevTestimonial"
            >
              ←
            </button>

            <div class="flex items-center gap-2">
              <button
                v-for="(_, i) in resolvedTestimonials"
                :key="i"
                type="button"
                :aria-label="`Voir témoignage ${i + 1}`"
                :class="[
                  'h-2 rounded-full transition-all duration-300',
                  activeTestimonial === i ? 'w-8 bg-primary' : 'w-2 bg-outline-variant hover:bg-primary/40',
                ]"
                @click="activeTestimonial = i"
              />
            </div>

            <button
              type="button"
              aria-label="Témoignage suivant"
              class="w-10 h-10 rounded-full border border-outline-variant text-primary flex items-center justify-center hover:bg-surface-container transition-colors"
              @click="nextTestimonial"
            >
              →
            </button>
          </div>
        </div>
        <div class="text-center mt-10">
          <a
            href="https://search.google.com/local/writereview?placeid=ChIJf0hxfazRyUwRzgp46r7fzIQ"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-sm"
          >
            <span class="text-base">★</span>
            Voir les avis Google
          </a>
        </div>
      </div>
    </section>

    <!-- ── MID-PAGE CTA ────────────────────────────────────────────────── -->
    <section class="px-6 py-14 md:py-20 bg-surface-container-low">
      <div class="max-w-2xl mx-auto text-center">
        <p class="text-on-surface-variant mb-5 text-lg leading-relaxed">
          Prêt·e à prendre le premier rendez-vous?
        </p>
        <button
          class="bg-primary text-on-primary px-10 py-5 rounded-xl font-semibold text-base hover:bg-primary-container transition-colors"
          @click="openBooking('mid')"
        >
          Voir les disponibilités
        </button>
      </div>
    </section>

    <!-- ── FAQ ─────────────────────────────────────────────────────────── -->
    <section
      class="px-6 py-16 md:py-24"
      v-bind="tlsBlockAttrs(on, 'faq', 'list')"
    >
      <div class="max-w-3xl mx-auto">
        <h2
          class="font-headline text-primary text-3xl md:text-4xl mb-10 md:mb-14"
          v-bind="tlsBlockFieldAttrs(on, docId, 'faq', 'title')"
        >
          {{ cmsPage?.faq?.title || 'Tes questions.' }}
        </h2>
        <div class="space-y-3">
          <details
            v-for="(q, i) in resolvedFaq"
            :key="i"
            class="group bg-surface-container-low rounded-xl border border-outline-variant/40 open:editorial-shadow"
          >
            <summary
              class="cursor-pointer list-none flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-5 font-semibold text-primary"
            >
              <span v-bind="tlsBlockFieldAttrs(on, docId, 'faq', `items/${i}/title`)">{{ q.question }}</span>
              <span
                class="shrink-0 w-7 h-7 rounded-full bg-primary-fixed text-primary flex items-center justify-center transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div class="px-5 md:px-6 pb-5 md:pb-6 text-on-surface-variant leading-relaxed">
              <p v-bind="tlsBlockFieldAttrs(on, docId, 'faq', `items/${i}/body`)">{{ q.answer }}</p>
            </div>
          </details>
        </div>
      </div>
    </section>

    <!-- ── LOCATION ────────────────────────────────────────────────────── -->
    <section class="px-6 py-16 md:py-24 bg-surface-container-low">
      <div class="max-w-3xl mx-auto">
        <h2 class="font-headline text-primary text-3xl md:text-4xl mb-8">
          Où me rencontrer.
        </h2>
        <div class="grid md:grid-cols-2 gap-8">
          <div>
            <p class="font-semibold text-primary mb-2">En présentiel</p>
            <p class="text-on-surface-variant leading-relaxed">
              Shefford, Haute-Yamaska (Québec)<br>
              Stationnement gratuit sur place.
            </p>
          </div>
          <div>
            <p class="font-semibold text-primary mb-2">En vidéoconférence</p>
            <p class="text-on-surface-variant leading-relaxed">
              Partout au Québec, lien GoogleMeet envoyé avec la confirmation. Aucune installation requise.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── FINAL CTA ──────────────────────────────────────────────────── -->
    <section
      class="px-6 py-20 md:py-28"
      v-bind="tlsBlockAttrs(on, 'cta', 'cta')"
    >
      <div class="max-w-2xl mx-auto text-center">
        <p
          class="font-headline italic text-primary text-2xl md:text-3xl leading-snug md:leading-9 mb-8"
          v-bind="tlsBlockFieldAttrs(on, docId, 'cta', 'note')"
        >
          <template v-if="cmsPage?.cta?.note">{{ cmsPage.cta.note }}</template>
          <template v-else>
            Le premier pas est le plus difficile.<br>
            On commence quand tu es prêt·e.
          </template>
        </p>
        <button
          class="bg-primary text-on-primary px-12 py-5 rounded-xl font-semibold text-base hover:bg-primary-container transition-colors"
          v-bind="tlsBlockFieldAttrs(on, docId, 'cta', 'label')"
          @click="openBooking('final')"
        >
          {{ cmsPage?.cta?.label || 'Prendre rendez-vous' }}
        </button>
        <div class="mt-6">
          <button
            class="text-sm text-on-surface-variant hover:text-primary transition-colors underline underline-offset-4"
            @click="contact.open()"
          >
            J'ai une question avant de réserver →
          </button>
        </div>
      </div>
    </section>

    <!-- Sticky mobile CTA (reveals after user scrolls past hero) -->
    <BookingStickyBar
      :service-id="selectedService"
      reveal-after-selector="[data-lp-hero]"
      :label="selectedService === 'couple' ? 'Réserver — Coaching couple' : 'Réserver — Thérapie individuelle'"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { BOOKING_SERVICES, type BookingServiceId } from '~/utils/bookingServices'
import { useTracking } from '~/composables/useTracking'
import {
  pageDocId,
  tlsBlockAttrs,
  tlsBlockFieldAttrs,
  tlsBlockImageAttrs,
} from '../../lib/tls-edit-attrs'
import { useBooking } from '../composables/useBooking'
import { useContact } from '../composables/useContact'
import BookingStickyBar from '../components/BookingStickyBar.vue'

export interface CmsBookingLpPageData {
  docId?: string
  hero?: {
    eyebrow?: string
    heading?: [string, string?]
    lede?: string
    ctaLabel?: string
    image?: { src?: string; key?: string; alt?: string; srcset?: string }
  }
  etapes?: {
    title?: string
    items?: Array<{ title?: string; body?: string }>
  }
  temoignages?: {
    title?: string
    items?: Array<{ title?: string; subtitle?: string; body?: string }>
  }
  faq?: {
    title?: string
    items?: Array<{ title?: string; body?: string }>
  }
  cta?: {
    note?: string
    label?: string
  }
}

const props = defineProps<{
  previewMode?: boolean
  cmsPage?: CmsBookingLpPageData
}>()

const on = computed(() => Boolean(props.previewMode))
const docId = computed(() => props.cmsPage?.docId || pageDocId('prendre-rendez-vous'))

const rawHeroImgSrc = computed(() => {
  const raw = (props.cmsPage?.hero?.image?.src ?? props.cmsPage?.hero?.image?.key ?? '').trim()
  if (!raw) return undefined
  return (raw.startsWith('/') || /^https?:\/\//.test(raw)) ? raw : `/media/${raw.replace(/^\/+/, '')}`
})
const heroImageSrc = computed(() => rawHeroImgSrc.value ?? '/images/chantal-hero.jpg')
const heroImageSrcset = computed(() => {
  if (props.cmsPage?.hero?.image?.srcset) return props.cmsPage.hero.image.srcset
  const src = rawHeroImgSrc.value
  if (src && src.startsWith('/media/')) {
    const base = src.split('?')[0]!
    return [640, 960, 1280, 1920].map(w => `${base}?w=${w} ${w}w`).join(', ')
  }
  if (!src) {
    return '/images/hero/chantal-hero-615.webp 615w, /images/hero/chantal-hero-877.webp 877w, /images/hero/chantal-hero-1230.webp 1230w, /images/hero/chantal-hero-1754.webp 1754w'
  }
  return undefined
})
const heroImageAlt = computed(
  () => props.cmsPage?.hero?.image?.alt?.trim() || "Chantal Massé, thérapeute en relation d'aide",
)

const booking = useBooking()
const contact = useContact()
const { trackEvent } = useTracking()

const heroEl = ref<HTMLElement | null>(null)

const SERVICE_OPTIONS: Array<{ id: BookingServiceId; label: string }> = [
  { id: 'individual', label: 'Individuelle' },
  { id: 'couple', label: 'Couple' },
]

const selectedService = ref<BookingServiceId>('individual')

const STEPS = [
  {
    title: 'Choisis ton service et une heure',
    body: 'Thérapie individuelle (60 min) en présentiel ou vidéoconférence. Coaching de couple (90 min) en présentiel. Disponibilités en temps réel, connectées à mon agenda.',
  },
  {
    title: 'Remplis un court formulaire',
    body: 'Nom, courriel, et quelques mots sur ce qui t\'amène — seulement si tu le souhaites. Aucun long questionnaire.',
  },
  {
    title: 'Reçois ta confirmation',
    body: 'Tu reçois immédiatement un courriel avec les détails et, pour les séances en ligne, ton lien Google Meet. On se voit au rendez-vous.',
  },
]

const resolvedSteps = computed(() => {
  const items = props.cmsPage?.etapes?.items
  if (!items || items.length === 0) return STEPS
  return STEPS.map((fb, i) => ({
    title: items[i]?.title?.trim() || fb.title,
    body: items[i]?.body?.trim() || fb.body,
  }))
})

const TESTIMONIALS = [
  {
    quote:
      "Les moments partagés avec Chantal ont été simplement bénissant. Elle m'a doucement guider dans mes réflexions et m'a aidé à travailler sur moi-même. Douce, empathique, à l'écoute — Chantal sait nous accompagner dans un respect des plus complet.",
    name: 'Alexandra',
    context: 'En thérapie individuelle',
  },
  {
    quote:
      "Nous avons beaucoup apprécié les séances de coaching de couple avec Chantal, car elle sait très bien établir une ambiance propice aux échanges. Son approche permet de créer des ponts qui favorisent l'ouverture, la compréhension et l'acceptation.",
    name: 'Véronique & Dany',
    context: 'En thérapie de couple',
  },
  {
    quote:
      "Avec Chantal, c'est simple et facile de parler. Elle va à notre rythme tout en nous amenant plus loin dans notre vie. Je vous la recommande à 100%.",
    name: 'Myriam',
    context: 'En thérapie individuelle',
  },
]

const resolvedTestimonials = computed(() => {
  const items = props.cmsPage?.temoignages?.items
  if (!items || items.length === 0) return TESTIMONIALS
  return items.map((it, i) => {
    const fb = TESTIMONIALS[i]
    return {
      quote: it.body?.trim() || fb?.quote || '',
      name: it.title?.trim() || fb?.name || '',
      context: it.subtitle?.trim() || fb?.context || '',
    }
  }).filter(t => t.quote && t.name)
})

const FAQ = [
  {
    question: 'Combien ça coûte?',
    // The booking modal skips the service step when a service is preselected,
    // so the prices are stated here, from the same source as the modal.
    answer: `${BOOKING_SERVICES.map(s => `${s.name} (${s.duration}) : ${s.price} $`).join(' · ')}. Le tarif est rappelé avant que tu confirmes ta réservation — aucune surprise.`,
  },
  {
    question: 'Combien de temps dure une séance?',
    answer: 'Thérapie individuelle : 60 minutes. Coaching de couple : 90 minutes.',
  },
  {
    question: 'Est-ce remboursé par mes assurances?',
    answer:
      "La plupart des assurances privées (Sun Life, Manuvie, Desjardins, etc.) remboursent les services de thérapeute en relation d'aide. Je fournis un reçu officiel après chaque séance — vérifie auprès de ton assureur le pourcentage couvert.",
  },
  {
    question: 'Quelle est la politique d\'annulation?',
    answer:
      'Tu peux annuler ou reporter gratuitement jusqu\'à 24 heures avant la séance. Un lien d\'annulation est inclus dans ton courriel de confirmation.',
  },
  {
    question: 'Présentiel ou vidéoconférence — comment choisir?',
    answer:
      "La vidéo est aussi efficace que le présentiel pour la majorité des situations et t'évite le trajet. Le présentiel est privilégié si tu cherches un cadre plus défini ou si la vidéo te distrait. Tu peux alterner d'une séance à l'autre — c'est flexible.",
  },
  {
    question: 'Quelle est ta formation?',
    answer:
      "Thérapeute en relation d'aide avec 13 ans de pratique, spécialisée en thérapie individuelle et coaching de couple. J'accompagne depuis Shefford et en vidéoconférence partout au Québec.",
  },
]

const resolvedFaq = computed(() => {
  const items = props.cmsPage?.faq?.items
  if (!items || items.length === 0) return FAQ
  return FAQ.map((fb, i) => ({
    question: items[i]?.title?.trim() || fb.question,
    answer: items[i]?.body?.trim() || fb.answer,
  }))
})

const activeTestimonial = ref(0)
const pauseCarousel = ref(false)
let carouselTimer: ReturnType<typeof setInterval> | null = null

function nextTestimonial(): void {
  const len = resolvedTestimonials.value.length || 1
  activeTestimonial.value = (activeTestimonial.value + 1) % len
}

function prevTestimonial(): void {
  const len = resolvedTestimonials.value.length || 1
  activeTestimonial.value = (activeTestimonial.value - 1 + len) % len
}

onMounted(() => {
  carouselTimer = setInterval(() => {
    if (!pauseCarousel.value) nextTestimonial()
  }, 7000)
})

onBeforeUnmount(() => {
  if (carouselTimer) clearInterval(carouselTimer)
})

function openBooking(source: 'hero' | 'mid' | 'final') {
  trackEvent('lp_cta_click', {
    event_category: 'booking_landing_page',
    event_label: source,
    service: selectedService.value,
  })
  booking.open(selectedService.value)
}

watch(selectedService, (val) => {
  trackEvent('lp_service_switch', {
    event_category: 'booking_landing_page',
    event_label: val,
  })
})

// Auto-open modal if ?book=open is in the URL (Google Ads deep-link support).
onMounted(() => {
  const q = new URLSearchParams(window.location.search)
  const service = q.get('service')
  if (service === 'individual' || service === 'couple') {
    selectedService.value = service
  }
  const book = q.get('book')
  if (book === 'open' || book === 'true' || book === '1') {
    booking.open(selectedService.value)
  }
})
</script>

<style scoped>
/* Hero needs an anchor for the sticky bar IntersectionObserver */
section:first-child {
  position: relative;
}
</style>
