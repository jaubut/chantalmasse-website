<template>
  <section class="min-h-[921px] flex items-center overflow-hidden px-8 lg:px-20 pt-24 pb-16 bg-background">
    <div class="max-w-screen-xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

      <!-- Left column -->
      <div class="order-2 lg:order-1 flex flex-col gap-8">
        <span class="inline-flex w-fit items-center bg-secondary-fixed text-on-secondary-container text-xs uppercase tracking-widest rounded-full px-4 py-2" data-animate>
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
          Thérapeute en relation d'aide à <span class="italic">Shefford</span>
        </h1>
        <h2 class="font-headline text-3xl lg:text-5xl text-primary/80 leading-[1.1] tracking-tight" data-animate>
          Tu as de la <span class="italic">valeur</span> — ne laisse pas ta souffrance te définir et te voler ton présent.
        </h2>

        <p class="text-on-surface-variant text-xl max-w-lg font-light" data-animate>
          Une approche douce et consciente pour naviguer les transitions de vie, apaiser les conflits relationnels et cultiver un amour durable.
        </p>

        <div class="flex flex-col sm:flex-row gap-4" data-animate>
          <button
            class="bg-primary text-on-primary px-10 py-5 rounded-xl font-semibold text-center hover:bg-primary-container transition-colors"
            @click="booking.open()"
          >
            Prendre rendez-vous
          </button>
          <a href="#services" class="border border-outline-variant/40 px-10 py-5 rounded-xl text-center hover:bg-surface-container transition-colors font-light" style="background-color: rgba(254,248,243,0.4); backdrop-filter: blur(4px);">
            En savoir plus
          </a>
        </div>
      </div>

      <!-- Right column -->
      <div class="order-1 lg:order-2 relative">
        <div class="absolute -bottom-10 -left-10 w-64 h-64 rounded-full blur-3xl -z-10" style="background-color: rgba(219,225,255,0.3);"></div>
        <div class="aspect-[4/5] rounded-[2rem] overflow-hidden lg:translate-x-12 translate-y-4">
          <img
            src="/images/chantal-hero.jpg"
            alt="Chantal Massé, thérapeute"
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

const labels = ['Thérapeute en relations d\'aide', 'Coach de couple']
const activeLabel = ref(0)
const ghostEls = ref<HTMLElement[]>([])
const containerWidth = ref<number | null>(null)

function updateWidth() {
  const el = ghostEls.value[activeLabel.value]
  if (el) containerWidth.value = el.offsetWidth
}

onMounted(() => {
  updateWidth()
  setInterval(() => {
    activeLabel.value = (activeLabel.value + 1) % labels.length
    updateWidth()
  }, 3000)
})
</script>
