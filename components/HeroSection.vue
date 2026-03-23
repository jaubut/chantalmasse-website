<template>
  <section class="min-h-[921px] flex items-center overflow-hidden px-8 lg:px-20 pt-24 pb-16 bg-background">
    <div class="max-w-screen-xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

      <!-- Left column -->
      <div class="order-2 lg:order-1 flex flex-col gap-8">
        <span class="inline-flex w-fit items-center bg-secondary-fixed text-on-secondary-container text-xs uppercase tracking-widest rounded-full px-4 py-2" data-animate>
          Accompagnement Thérapeutique
        </span>

        <h1 class="font-headline text-6xl lg:text-8xl text-primary leading-[1.05] tracking-tight" data-animate>
          Retrouvez la <span class="italic">connexion</span> — avec vous-même et avec l'autre.
        </h1>

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
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80"
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
</script>
