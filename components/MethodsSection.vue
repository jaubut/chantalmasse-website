<template>
  <section class="py-32 px-8 bg-surface-container">
    <div class="max-w-screen-xl mx-auto">

      <div class="text-center mb-16">
        <h2 class="font-headline text-5xl text-primary italic" data-animate>Méthodologies &amp; Approches</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">

        <div class="bg-surface-container-high p-12 rounded-[2rem] text-center hover:bg-surface-container-highest transition-colors duration-300" data-animate>
          <Icon icon="material-symbols:psychology" class="text-4xl text-secondary flex justify-center items-center mx-auto mb-6" />
          <h4 class="font-headline text-2xl text-primary mb-4">ANDC</h4>
          <p class="text-on-surface-variant font-light leading-relaxed">
            Approche Non-Directive Créatrice axée sur la relation authentique et le moment présent.
          </p>
        </div>

        <div class="bg-surface-container-high p-12 rounded-[2rem] text-center hover:bg-surface-container-highest transition-colors duration-300" data-animate>
          <Icon icon="material-symbols:diversity-2" class="text-4xl text-secondary flex justify-center items-center mx-auto mb-6" />
          <h4 class="font-headline text-2xl text-primary mb-4">Imago</h4>
          <p class="text-on-surface-variant font-light leading-relaxed">
            Thérapie relationnelle transformant les dynamiques de couple par le dialogue intentionnel.
          </p>
        </div>

        <div class="bg-surface-container-high p-12 rounded-[2rem] text-center hover:bg-surface-container-highest transition-colors duration-300" data-animate>
          <Icon icon="material-symbols:neurology" class="text-4xl text-secondary flex justify-center items-center mx-auto mb-6" />
          <h4 class="font-headline text-2xl text-primary mb-4">Neurosciences</h4>
          <p class="text-on-surface-variant font-light leading-relaxed">
            Compréhension des mécanismes du cerveau pour mieux réguler le stress et les émotions.
          </p>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>
