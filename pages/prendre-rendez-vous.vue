<template>
  <div class="bg-background text-on-surface font-body">
    <!-- ── HERO ──────────────────────────────────────────────────────────── -->
    <section
      ref="heroEl"
      data-lp-hero
      class="relative px-6 pt-24 pb-16 md:pt-32 md:pb-24"
    >
      <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">

        <!-- Portrait — order-2 on mobile, order-1 (left) on md+ -->
        <div class="order-2 md:order-1">
          <div class="aspect-[4/5] max-w-md mx-auto md:mx-0 rounded-[2rem] overflow-hidden">
            <img
              src="/images/chantal-hero.jpg"
              alt="Chantal Massé, thérapeute en relation d'aide"
              class="w-full h-full object-cover"
              style="filter: grayscale(8%);"
              loading="eager"
              fetchpriority="high"
            />
          </div>
        </div>

        <!-- Text + CTA -->
        <div class="order-1 md:order-2">
          <!-- Trust pill -->
          <span
            class="inline-flex items-center bg-secondary-fixed text-on-secondary-container text-[11px] uppercase tracking-widest rounded-full px-4 py-2 mb-8"
          >
            20 ans de pratique · Shefford &amp; en vidéo
          </span>

          <!-- H1 -->
          <h1 class="font-headline italic text-primary leading-[1.05] text-[2.5rem] sm:text-5xl md:text-5xl lg:text-6xl tracking-tight mb-6">
            Réserve ta séance avec Chantal, en moins de 2 minutes.
          </h1>

          <!-- Subtitle -->
          <p class="text-lg md:text-xl text-on-surface-variant leading-relaxed max-w-xl mb-10">
            Thérapeute en relation d'aide à Shefford et en vidéoconférence partout au Québec.
            Premier rendez-vous sans engagement — disponibilités dans les 7 à 14 jours.
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
            @click="openBooking('hero')"
          >
            Prendre rendez-vous
          </button>

          <!-- Secondary reassurance -->
          <p class="mt-4 text-sm text-on-surface-variant">
            Sans engagement. Annulation possible jusqu'à 24h avant la séance.
          </p>
        </div>

      </div>
    </section>

    <!-- ── CE QUI T'ATTEND (3 steps) ───────────────────────────────────── -->
    <section class="px-6 py-16 md:py-24 bg-surface-container-low">
      <div class="max-w-3xl mx-auto">
        <h2 class="font-headline text-primary text-3xl md:text-4xl mb-10 md:mb-14">
          Ce qui t'attend
        </h2>
        <ol class="space-y-8 md:space-y-10">
          <li
            v-for="(step, i) in STEPS"
            :key="i"
            class="flex gap-5 md:gap-7"
          >
            <span
              class="shrink-0 w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-headline italic text-lg"
            >
              {{ i + 1 }}
            </span>
            <div>
              <p class="font-semibold text-primary text-lg mb-1">{{ step.title }}</p>
              <p class="text-on-surface-variant leading-relaxed">{{ step.body }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- ── TESTIMONIALS ────────────────────────────────────────────────── -->
    <section class="px-6 py-16 md:py-24">
      <div class="max-w-3xl mx-auto">
        <h2 class="font-headline text-primary italic text-3xl md:text-4xl mb-10 md:mb-14">
          Ce que les autres disent.
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
                v-for="t in TESTIMONIALS"
                :key="t.name"
                class="shrink-0 w-full px-1"
              >
                <div class="bg-surface-container-low p-8 md:p-10 rounded-[2rem] editorial-shadow">
                  <p class="font-headline text-4xl text-primary-fixed-dim leading-none mb-4">"</p>
                  <blockquote class="text-on-surface text-[17px] leading-relaxed mb-6 min-h-[9rem]">
                    {{ t.quote }}
                  </blockquote>
                  <figcaption>
                    <p class="font-semibold text-primary">{{ t.name }}</p>
                    <p class="text-sm text-on-surface-variant font-light">{{ t.context }}</p>
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
                v-for="(_, i) in TESTIMONIALS"
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
    <section class="px-6 py-16 md:py-24">
      <div class="max-w-3xl mx-auto">
        <h2 class="font-headline text-primary text-3xl md:text-4xl mb-10 md:mb-14">
          Tes questions.
        </h2>
        <div class="space-y-3">
          <details
            v-for="(q, i) in FAQ"
            :key="i"
            class="group bg-surface-container-low rounded-xl border border-outline-variant/40 open:editorial-shadow"
          >
            <summary
              class="cursor-pointer list-none flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-5 font-semibold text-primary"
            >
              <span>{{ q.question }}</span>
              <span
                class="shrink-0 w-7 h-7 rounded-full bg-primary-fixed text-primary flex items-center justify-center transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div class="px-5 md:px-6 pb-5 md:pb-6 text-on-surface-variant leading-relaxed">
              <p v-html="q.answer"></p>
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
    <section class="px-6 py-20 md:py-28">
      <div class="max-w-2xl mx-auto text-center">
        <p class="font-headline italic text-primary text-2xl md:text-3xl leading-snug mb-8">
          Le premier pas est le plus difficile.<br>
          On commence quand tu es prêt·e.
        </p>
        <button
          class="bg-primary text-on-primary px-12 py-5 rounded-xl font-semibold text-base hover:bg-primary-container transition-colors"
          @click="openBooking('final')"
        >
          Prendre rendez-vous
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
import type { BookingServiceId } from '~/utils/bookingServices'

definePageMeta({
  minimalNav: true,
})

useSeoMeta({
  title: 'Prendre rendez-vous avec Chantal Massé',
  description:
    'Réserve ta séance avec Chantal Massé, thérapeute en relation d\'aide à Shefford et en vidéoconférence. Premier rendez-vous sans engagement.',
  robots: 'noindex, nofollow',
  ogTitle: 'Prendre rendez-vous avec Chantal Massé',
  ogDescription:
    'Réserve ta séance avec Chantal Massé, thérapeute en relation d\'aide à Shefford et en vidéoconférence. Premier rendez-vous sans engagement.',
  ogImage: 'https://chantalmasse.com/images/chantal-hero.jpg',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

useHead({
  link: [{ rel: 'canonical', href: 'https://chantalmasse.com/prendre-rendez-vous' }],
})

const booking = useBooking()
const contact = useContact()
const { trackEvent } = useTracking()
const route = useRoute()

const heroEl = ref<HTMLElement | null>(null)

const SERVICE_OPTIONS: Array<{ id: BookingServiceId; label: string }> = [
  { id: 'individual', label: 'Individuelle' },
  { id: 'couple', label: 'Couple' },
]

const selectedService = ref<BookingServiceId>('individual')

const STEPS = [
  {
    title: 'Choisis ton service et une heure',
    body: 'Thérapie individuelle (60 min) ou coaching de couple (90 min), en présentiel ou en vidéoconférence. Disponibilités en temps réel, connectées à mon agenda.',
  },
  {
    title: 'Remplis un court formulaire',
    body: 'Nom, courriel, et quelques mots sur ce qui t\'amène — seulement si tu le souhaites. Aucun dossier médical, aucun long questionnaire.',
  },
  {
    title: 'Reçois ta confirmation',
    body: 'Tu reçois immédiatement un courriel avec les détails et, pour les séances en ligne, ton lien Google Meet. On se voit au rendez-vous.',
  },
]

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

const FAQ = [
  {
    question: 'Combien ça coûte?',
    answer:
      'Les tarifs sont affichés clairement à la première étape de la réservation. Tu vois les prix avant de choisir ta plage horaire — aucune surprise.',
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
      "Thérapeute en relation d'aide avec 20 ans de pratique, spécialisée en thérapie individuelle et coaching de couple. J'accompagne depuis Shefford et en vidéoconférence partout au Québec.",
  },
]

const activeTestimonial = ref(0)
const pauseCarousel = ref(false)
let carouselTimer: ReturnType<typeof setInterval> | null = null

function nextTestimonial(): void {
  activeTestimonial.value = (activeTestimonial.value + 1) % TESTIMONIALS.length
}

function prevTestimonial(): void {
  activeTestimonial.value = (activeTestimonial.value - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
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

// Auto-open modal if ?book=open is in the URL (Google Ads deep-link support)
onMounted(() => {
  const q = route.query
  if (typeof q.service === 'string' && (q.service === 'individual' || q.service === 'couple')) {
    selectedService.value = q.service
  }
  if (q.book === 'open' || q.book === 'true' || q.book === '1') {
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
