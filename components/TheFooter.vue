<template>
  <footer class="py-20 px-8" style="background-color: #f8f3ee;">
    <div class="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">

      <a href="/" class="font-headline italic text-2xl text-primary">Chantal Massé</a>

      <nav class="flex items-center gap-8">
        <NuxtLink to="/mentions-legales" class="text-sm uppercase tracking-wide text-on-surface-variant hover:text-primary transition-colors">Mentions Légales</NuxtLink>
        <NuxtLink to="/confidentialite" class="text-sm uppercase tracking-wide text-on-surface-variant hover:text-primary transition-colors">Confidentialité</NuxtLink>
        <a
          href="https://search.google.com/local/writereview?placeid=ChIJf0hxfazRyUwRzgp46r7fzIQ"
          target="_blank"
          rel="noopener"
          class="text-sm uppercase tracking-wide text-on-surface-variant hover:text-primary transition-colors"
        >Laisser un avis ★</a>
      </nav>

      <p class="text-sm uppercase tracking-wide" style="color: rgba(23,48,40,0.5);">
        © 2026 Chantal Massé. Tous droits réservés.
      </p>

    </div>
  </footer>
</template>
