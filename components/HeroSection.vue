<template>
  <section id="hero" class="min-h-0 md:min-h-[921px] flex items-center overflow-hidden px-8 lg:px-20 pt-24 pb-16 bg-background">
    <div class="max-w-screen-xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

      <!-- Left column -->
      <div class="order-1 lg:order-1 flex flex-col gap-8">
        <span class="inline-flex w-fit items-center bg-secondary-fixed text-primary text-xs font-medium uppercase tracking-widest rounded-full px-4 py-2" data-animate>
          <span
            ref="trackEl"
            class="relative inline-flex items-center overflow-hidden"
            :style="{ width: containerWidth ? containerWidth + 'px' : undefined, transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)' }"
          >
            <!-- Ghost refs: one per label, invisible, used to measure widths -->
            <span
              v-for="label in labels"
              :key="label"
              ref="ghostEls"
              class="invisible absolute whitespace-nowrap pointer-events-none"
              aria-hidden="true"
            >{{ label }}</span>
            <!-- Sliding labels -->
            <span
              v-for="(label, i) in labels"
              :key="'vis-' + label"
              class="whitespace-nowrap transition-all duration-500 ease-in-out"
              :class="i === activeLabel ? 'relative' : 'absolute'"
              :style="{
                opacity: i === activeLabel ? 1 : 0,
                transform: i === activeLabel ? 'translateY(0)' : i < activeLabel ? 'translateY(-100%)' : 'translateY(100%)',
              }"
            >{{ label }}</span>
          </span>
        </span>
        <h1 class="font-headline text-5xl lg:text-7xl text-primary leading-[1.05] tracking-tight" data-animate>
          Thérapeute en relation d'aide à
          <span
            class="italic relative inline-block cursor-default"
            @mouseenter="showMap = true"
            @mouseleave="showMap = false"
          >
            Shefford
            <Transition
              enter-active-class="transition duration-300 ease-out"
              enter-from-class="opacity-0 translate-y-2 scale-95"
              enter-to-class="opacity-100 translate-y-0 scale-100"
              leave-active-class="transition duration-200 ease-in"
              leave-from-class="opacity-100 translate-y-0 scale-100"
              leave-to-class="opacity-0 translate-y-2 scale-95"
            >
              <div
                v-show="showMap"
                class="absolute left-0 top-full mt-3 z-50 w-72 rounded-2xl overflow-hidden border border-outline-variant/30 shadow-xl"
                style="backdrop-filter: blur(12px); background: rgba(254,248,243,0.85);"
              >
                <iframe
                  v-if="mapLoaded"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2800!2d-72.6488387!3d45.404327!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cc9d1ac7d71487f%3A0x84ccdfbeea780ace!2sChantal+Mass%C3%A9+th%C3%A9rapeute+en+relation+d&#39;aide+et+coach+de+couples!5e0!3m2!1sfr!2sca"
                  width="288"
                  height="180"
                  style="border:0;"
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  title="Carte de Shefford, Québec"
                />
                <div v-else class="w-full h-[180px] bg-surface-container animate-pulse" />
                <a
                  href="https://www.google.com/maps/place/Chantal+Mass%C3%A9+th%C3%A9rapeute+en+relation+d'aide+et+coach+de+couples/@45.4043307,-72.6537096,17z"
                  target="_blank"
                  rel="noopener"
                  class="block px-4 py-3 not-italic tracking-wide hover:bg-surface-container transition-colors"
                >
                  <p class="font-body text-xs font-medium text-on-surface">245 rue Colette, Shefford</p>
                </a>
              </div>
            </Transition>
          </span>
        </h1>
        <h2 class="font-headline text-3xl lg:text-5xl text-primary/80 leading-[1.1] tracking-tight" data-animate>
          Tu as de la <span class="italic">valeur</span> — ne laisse pas ta souffrance te définir et te voler ton présent.
        </h2>

        <p class="text-on-surface-variant text-xl max-w-lg font-light" data-animate>
          Une approche douce et consciente pour naviguer les transitions de vie, apaiser les conflits relationnels et cultiver un amour durable.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center" data-animate>
          <button
            class="bg-secondary text-on-secondary px-10 py-5 rounded-xl font-semibold text-center hover:bg-secondary-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            @click="booking.open()"
          >
            Prendre rendez-vous
          </button>
          <a
            href="#services"
            class="inline-flex items-center justify-center gap-2 border-2 border-primary text-primary px-10 py-5 rounded-xl text-center font-medium hover:bg-primary hover:text-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            En savoir plus
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>

      <!-- Right column -->
      <div class="order-2 lg:order-2 relative">
        <div class="absolute -bottom-10 -left-10 w-64 h-64 rounded-full blur-3xl -z-10" style="background-color: rgba(219,225,255,0.3);"></div>
        <div class="aspect-[4/5] rounded-[2rem] overflow-hidden lg:translate-x-12 translate-y-4">
          <img
            src="/images/chantal-hero.jpg"
            alt="Chantal Massé, thérapeute en relation d'aide, dans son cabinet à Shefford"
            class="w-full h-full object-cover hover:scale-105 transition-transform duration-[2000ms]"
            style="filter: grayscale(20%);"
          />
        </div>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
const booking = useBooking()

const showMap = ref(false)
const mapLoaded = ref(false)

watch(showMap, (visible) => {
  if (visible && !mapLoaded.value) mapLoaded.value = true
})

const labels = ['Thérapeute en relations d\'aide', 'Coach de couple']
const activeLabel = ref(0)
const ghostEls = ref<HTMLElement[]>([])
const containerWidth = ref<number | null>(null)
let labelTimer: ReturnType<typeof setInterval> | null = null

function updateWidth() {
  const el = ghostEls.value[activeLabel.value]
  if (el) containerWidth.value = el.offsetWidth
}

onMounted(() => {
  updateWidth()
  labelTimer = setInterval(() => {
    activeLabel.value = (activeLabel.value + 1) % labels.length
    updateWidth()
  }, 3000)
})

onBeforeUnmount(() => {
  if (labelTimer) clearInterval(labelTimer)
})
</script>
