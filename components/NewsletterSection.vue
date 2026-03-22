<template>
  <section class="py-32 px-8 bg-tertiary text-on-tertiary">
    <div class="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

      <!-- Left: form -->
      <div data-animate>
        <h2 class="font-headline text-5xl mb-6">Pensées &amp; Réflexions</h2>
        <p class="text-on-tertiary-container font-light text-lg mb-10 max-w-md">
          Recevez mensuellement des pistes de réflexion, des pratiques de pleine conscience et des ressources pour nourrir vos relations.
        </p>
        <form class="flex flex-col sm:flex-row gap-4" @submit.prevent>
          <input
            type="email"
            placeholder="votre@courriel.com"
            class="flex-1 bg-tertiary-container text-on-tertiary rounded-xl px-6 py-4 outline-none placeholder-on-tertiary-container/60 focus:ring-2 focus:ring-secondary-fixed/50"
          />
          <button type="submit" class="bg-secondary-fixed text-on-secondary-container px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform whitespace-nowrap">
            S'abonner
          </button>
        </form>
      </div>

      <!-- Right: blog cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6" data-animate>

        <div class="bg-tertiary-container rounded-2xl overflow-hidden group">
          <div class="aspect-[4/3] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1516585427167-9f4af9627e6c?w=400&q=80"
              alt="Les 5 langages du pardon"
              class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          </div>
          <div class="p-6">
            <span class="text-xs uppercase tracking-widest text-secondary-fixed-dim mb-3 block">Lecture 4 min</span>
            <h4 class="font-headline text-xl text-on-tertiary">Les 5 langages du pardon</h4>
          </div>
        </div>

        <div class="bg-tertiary-container rounded-2xl overflow-hidden group">
          <div class="aspect-[4/3] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&q=80"
              alt="L'espace entre nous"
              class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          </div>
          <div class="p-6">
            <span class="text-xs uppercase tracking-widest text-secondary-fixed-dim mb-3 block">Lecture 6 min</span>
            <h4 class="font-headline text-xl text-on-tertiary">L'espace entre nous</h4>
          </div>
        </div>

      </div>
    </div>
  </section>
</template>
