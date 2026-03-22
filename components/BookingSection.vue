<template>
  <section id="booking" class="py-32 px-8 bg-background">
    <div class="max-w-screen-xl mx-auto">
      <div class="bg-surface-container-low rounded-[3rem] p-8 lg:p-24 relative overflow-hidden">

        <!-- Decorative icon -->
        <span class="material-symbols-outlined absolute top-0 right-0 text-primary opacity-10 select-none pointer-events-none" style="font-size: 20rem; line-height: 1; transform: translate(20%, -10%);">eco</span>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

          <!-- Left -->
          <div data-animate>
            <h2 class="font-headline text-5xl italic text-primary mb-6">
              Prêt à entamer ce voyage?
            </h2>
            <p class="text-on-surface-variant font-light text-lg mb-10">
              Consultations disponibles en personne à Shefford ou en vidéoconférence.
            </p>

            <ul class="space-y-6 mb-12">
              <li class="flex items-start gap-4">
                <span class="material-symbols-outlined text-primary mt-0.5">location_on</span>
                <div>
                  <p class="font-semibold text-on-surface">Bureau Shefford</p>
                  <p class="text-on-surface-variant font-light">Région de la Haute-Yamaska</p>
                </div>
              </li>
              <li class="flex items-start gap-4">
                <span class="material-symbols-outlined text-primary mt-0.5">verified</span>
                <div>
                  <p class="font-semibold text-on-surface">Membre RITMA</p>
                  <p class="text-on-surface-variant font-light">Reçus pour fins d'assurances disponibles</p>
                </div>
              </li>
            </ul>

            <a href="#booking" class="inline-block bg-primary text-on-primary px-12 py-6 rounded-2xl font-bold text-xl hover:scale-105 transition-transform">
              Réserver une séance
            </a>
          </div>

          <!-- Right: schedule card -->
          <div class="bg-surface p-12 rounded-[2rem] editorial-shadow" data-animate>
            <h4 class="font-headline text-2xl italic text-primary mb-8">Horaires habituels</h4>
            <div class="space-y-0">
              <div class="flex justify-between py-4 border-b border-outline-variant/20">
                <span class="text-on-surface font-medium">Lundi — Jeudi</span>
                <span class="text-on-surface-variant font-light">09:00 — 18:00</span>
              </div>
              <div class="flex justify-between py-4 border-b border-outline-variant/20">
                <span class="text-on-surface font-medium">Vendredi</span>
                <span class="text-on-surface-variant font-light">09:00 — 14:00</span>
              </div>
              <div class="flex justify-between py-4">
                <span class="text-outline font-medium">Samedi — Dimanche</span>
                <span class="text-outline font-light">Fermé</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>
</template>
