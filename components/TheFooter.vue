<script setup lang="ts">
const contact = useContact()
</script>

<template>
  <footer class="py-20 px-8" style="background-color: #f8f3ee;">
    <div class="max-w-screen-xl mx-auto flex flex-col md:flex-row items-start justify-between gap-12">

      <!-- Name + address -->
      <div class="flex flex-col gap-2">
        <a href="/" class="font-headline italic text-2xl text-primary">Chantal Massé</a>
        <a
          href="https://www.google.com/maps/place/Chantal+Mass%C3%A9+th%C3%A9rapeute+en+relation+d'aide+et+coach+de+couples/@45.4043307,-72.6537096,17z"
          target="_blank"
          rel="noopener"
          class="text-base md:text-sm text-on-surface-variant hover:text-primary transition-colors tracking-wide"
        >245 rue Colette, Shefford, QC J2M 2B7</a>
        <button class="mt-2 w-fit min-h-[44px] px-8 py-3 rounded-xl font-semibold bg-primary text-on-primary hover:bg-primary-container transition-colors" @click="contact.open()">
          Me contacter
        </button>
      </div>

      <!-- Links -->
      <nav class="flex flex-col gap-3">
        <NuxtLink to="/mentions-legales" class="text-base md:text-sm uppercase tracking-wide text-on-surface-variant hover:text-primary transition-colors">Mentions Légales</NuxtLink>
        <NuxtLink to="/confidentialite" class="text-base md:text-sm uppercase tracking-wide text-on-surface-variant hover:text-primary transition-colors">Confidentialité</NuxtLink>
        <a
          href="https://search.google.com/local/writereview?placeid=ChIJf0hxfazRyUwRzgp46r7fzIQ"
          target="_blank"
          rel="noopener"
          class="text-base md:text-sm uppercase tracking-wide text-on-surface-variant hover:text-primary transition-colors"
        >Laisser un avis ★</a>
      </nav>

    </div>

    <p class="max-w-screen-xl mx-auto text-center mt-8 text-base md:text-sm uppercase tracking-wide text-on-surface-variant">
      © 2026 Chantal Massé. Tous droits réservés.
    </p>
  </footer>
</template>
