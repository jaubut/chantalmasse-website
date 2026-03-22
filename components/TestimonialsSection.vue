<template>
  <section class="py-32 px-8 overflow-hidden bg-background">
    <div class="max-w-screen-xl mx-auto">

      <div class="text-center mb-16">
        <h2 class="font-headline text-5xl text-primary italic" data-animate>Témoignages</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

        <div class="bg-surface-container-low p-12 rounded-[2rem] editorial-shadow" data-animate>
          <div class="flex gap-1 mb-6">
            <span v-for="i in 5" :key="i" class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;">star</span>
          </div>
          <p class="text-on-surface-variant font-light leading-relaxed mb-8 italic">
            "Chantal a cette capacité rare d'écouter au-delà des mots. Après quelques séances, nous avons redécouvert ce qui nous avait réunis au départ."
          </p>
          <p class="font-semibold text-primary">Sophie &amp; Marc</p>
        </div>

        <div class="bg-surface-container-low p-12 rounded-[2rem] editorial-shadow lg:translate-y-8" data-animate>
          <div class="flex gap-1 mb-6">
            <span v-for="i in 5" :key="i" class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;">star</span>
          </div>
          <p class="text-on-surface-variant font-light leading-relaxed mb-8 italic">
            "Une approche douce et efficace. J'ai retrouvé une paix intérieure que je croyais perdue. Je recommande chaleureusement."
          </p>
          <p class="font-semibold text-primary">Pierre L.</p>
        </div>

        <div class="bg-surface-container-low p-12 rounded-[2rem] editorial-shadow" data-animate>
          <div class="flex gap-1 mb-6">
            <span v-for="i in 5" :key="i" class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;">star</span>
          </div>
          <p class="text-on-surface-variant font-light leading-relaxed mb-8 italic">
            "Le dialogue Imago a transformé notre façon de communiquer. Nous avons enfin les outils pour nous comprendre vraiment."
          </p>
          <p class="font-semibold text-primary">Julie R.</p>
        </div>

      </div>
    </div>
  </section>
</template>
