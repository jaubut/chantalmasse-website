<template>
  <section id="services" class="py-32 px-8 bg-surface-container-low">
    <div class="max-w-screen-xl mx-auto">

      <!-- Header -->
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-16">
        <h2 class="font-headline text-5xl text-primary italic" data-animate>
          Accompagnements personnalisés
        </h2>
        <p class="text-on-surface-variant max-w-sm font-light" data-animate>
          Chaque parcours est unique. Je vous accompagne là où vous en êtes, avec douceur et présence.
        </p>
      </div>

      <!-- Cards grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <!-- Individual Therapy -->
        <div class="group bg-surface-container-lowest p-12 rounded-[2.5rem] editorial-shadow hover:-translate-y-2 transition-transform duration-300" data-animate>
          <div class="w-14 h-14 bg-primary-fixed rounded-xl flex items-center justify-center mb-8">
            <span class="material-symbols-outlined text-primary text-2xl">person</span>
          </div>
          <h3 class="font-headline text-3xl text-primary mb-2">Thérapie Individuelle</h3>
          <p class="font-headline italic text-on-surface-variant mb-6">60 minutes pour soi</p>
          <p class="text-on-surface-variant font-light mb-6">
            Un espace sécurisé pour explorer vos patterns relationnels, vos blessures d'attachement et vos ressources intérieures.
          </p>
          <ul class="space-y-3 mb-10">
            <li class="flex items-center gap-3 text-on-surface-variant font-light">
              <span class="material-symbols-outlined text-primary text-lg">check_circle</span>
              Approche centrée sur le cœur
            </li>
            <li class="flex items-center gap-3 text-on-surface-variant font-light">
              <span class="material-symbols-outlined text-primary text-lg">check_circle</span>
              Reçus d'assurance RITMA
            </li>
          </ul>
          <button class="w-full border border-outline-variant py-4 rounded-xl font-semibold group-hover:bg-primary group-hover:text-on-primary group-hover:border-primary transition-all duration-300">
            En savoir plus
          </button>
        </div>

        <!-- Couple Coaching -->
        <div class="group bg-primary p-12 rounded-[2.5rem] editorial-shadow hover:-translate-y-2 transition-transform duration-300" data-animate>
          <div class="w-14 h-14 bg-secondary-fixed rounded-xl flex items-center justify-center mb-8">
            <span class="material-symbols-outlined text-secondary text-2xl">favorite</span>
          </div>
          <h3 class="font-headline text-3xl text-on-primary mb-2">Coaching de Couple</h3>
          <p class="font-headline italic text-on-primary-container mb-6">90 minutes de dialogue</p>
          <p class="text-on-primary-container font-light mb-6">
            Une méthode structurée pour transformer les conflits répétitifs en opportunités de connexion profonde.
          </p>
          <ul class="space-y-3 mb-10">
            <li class="flex items-center gap-3 text-on-primary-container font-light">
              <span class="material-symbols-outlined text-on-primary text-lg">check_circle</span>
              Dialogue intentionnel Imago
            </li>
            <li class="flex items-center gap-3 text-on-primary-container font-light">
              <span class="material-symbols-outlined text-on-primary text-lg">check_circle</span>
              Outils de communication concrets
            </li>
          </ul>
          <button class="w-full bg-surface text-primary py-4 rounded-xl font-semibold hover:bg-secondary-fixed transition-colors duration-300">
            En savoir plus
          </button>
        </div>

      </div>
    </div>
  </section>
</template>
