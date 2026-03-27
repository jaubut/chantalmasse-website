<template>
  <section id="apropos" class="py-32 px-8 bg-surface-container">
    <div class="max-w-screen-xl mx-auto space-y-24">

      <!-- Personal intro -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div data-animate>
          <h2 class="font-headline text-5xl text-primary italic mb-8">Qui je suis</h2>
          <p class="text-on-surface-variant font-light leading-relaxed mb-5">
            J'ai un grand intérêt pour l'être humain et les relations. Ayant déjà été confrontée moi-même à un bouleversement dans ma vie personnelle, cela m'a amené à vouloir tendre la main à d'autres qui ont besoin d'être accompagnés afin de retrouver un équilibre et atteindre leurs objectifs de mieux-être.
          </p>
          <p class="text-on-surface-variant font-light leading-relaxed mb-5">
            La souffrance est différente quand on peut partager ce que l'on vit dans la compréhension, l'empathie et sans jugement. Je suis reconnue pour mon professionnalisme, mon écoute et ma fiabilité.
          </p>
          <p class="text-on-surface-variant font-light leading-relaxed">
            Mes formations et mon expérience amènent les adultes et les couples dans une meilleure compréhension d'eux-mêmes, de ce qu'ils vivent, à mieux communiquer et à faire des choix conscients vers la réalisation de leurs objectifs.
          </p>
        </div>

        <!-- Therapist credentials -->
        <div class="bg-surface-container-high rounded-[2rem] p-10" data-animate>
          <div class="flex items-center gap-4 mb-6">
            <Icon icon="material-symbols:verified-user" class="text-3xl text-secondary" />
            <h3 class="font-headline text-2xl text-primary">Thérapeute</h3>
          </div>
          <p class="text-on-surface-variant font-light leading-relaxed mb-5">
            Chantal Massé est thérapeute spécialisée en relation humaine et coach relationnel de couple. Elle offre un service axé sur le respect et la dignité de la personne et répond aux exigences du Code de Déontologie de <strong class="font-medium text-on-surface">RITMA</strong> (Regroupement des Intervenants et Thérapeutes en Médecine Alternative).
          </p>
          <p class="text-sm text-on-surface-variant font-light leading-relaxed p-4 rounded-xl" style="background-color: rgba(219,225,255,0.25);">
            Les consultations en relation d'aide sont couvertes par la plupart des compagnies d'assurances privées et/ou déductibles d'impôts.
          </p>
        </div>
      </div>

      <!-- Approach cards -->
      <div>
        <h3 class="font-headline text-3xl text-primary italic text-center mb-10" data-animate>Approches thérapeutiques</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">

          <div class="bg-surface-container-high p-10 rounded-[2rem] text-center hover:bg-surface-container-highest transition-colors duration-300" data-animate>
            <Icon icon="material-symbols:psychology" class="text-4xl text-secondary flex justify-center items-center mx-auto mb-6" />
            <h4 class="font-headline text-2xl text-primary mb-4">Relations humaines</h4>
            <p class="text-on-surface-variant font-light leading-relaxed">
              Accompagnement individualisé vers une meilleure compréhension de soi et de ses relations, pour des choix conscients et épanouissants.
            </p>
          </div>

          <div class="bg-surface-container-high p-10 rounded-[2rem] text-center hover:bg-surface-container-highest transition-colors duration-300" data-animate>
            <Icon icon="material-symbols:diversity-2" class="text-4xl text-secondary flex justify-center items-center mx-auto mb-6" />
            <h4 class="font-headline text-2xl text-primary mb-4">Imago & Couple</h4>
            <p class="text-on-surface-variant font-light leading-relaxed">
              Thérapie relationnelle internationale transformant les dynamiques de couple par le dialogue intentionnel et la reconnexion profonde.
            </p>
          </div>

          <div class="bg-surface-container-high p-10 rounded-[2rem] text-center hover:bg-surface-container-highest transition-colors duration-300" data-animate>
            <Icon icon="material-symbols:neurology" class="text-4xl text-secondary flex justify-center items-center mx-auto mb-6" />
            <h4 class="font-headline text-2xl text-primary mb-4">Neurosciences</h4>
            <p class="text-on-surface-variant font-light leading-relaxed">
              Compréhension des mécanismes du cerveau pour mieux réguler le stress, les émotions et renforcer le lien dans la relation de couple.
            </p>
          </div>

        </div>
      </div>

      <!-- Formations -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        <div data-animate>
          <div class="flex items-center gap-4 mb-8">
            <Icon icon="material-symbols:school" class="text-3xl text-secondary" />
            <h3 class="font-headline text-3xl text-primary italic">Formations</h3>
          </div>
          <p class="text-on-surface-variant font-light leading-relaxed mb-8">
            Dans le but d'améliorer continuellement mes compétences et d'offrir un service de qualité, j'apporte une grande importance à la formation continue.
          </p>
          <ul class="space-y-4">
            <li v-for="formation in formations" :key="formation.title" class="flex items-start gap-4">
              <span class="mt-1 w-2 h-2 rounded-full bg-secondary flex-shrink-0"></span>
              <div>
                <p class="text-on-surface font-medium">{{ formation.title }}</p>
                <p v-if="formation.institution" class="text-sm text-on-surface-variant font-light">{{ formation.institution }}</p>
              </div>
            </li>
          </ul>
        </div>

        <div class="bg-surface-container-high rounded-[2rem] p-10" data-animate>
          <div class="flex items-center gap-4 mb-6">
            <Icon icon="material-symbols:family-restroom" class="text-3xl text-secondary" />
            <h3 class="font-headline text-2xl text-primary">Parent Guide, Parent Complice</h3>
          </div>
          <p class="text-on-surface-variant font-light leading-relaxed">
            Formatrice certifiée pour accompagner les parents dans le développement d'une relation harmonieuse et complice avec leurs enfants, en favorisant une communication bienveillante et des liens solides.
          </p>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const formations = [
  {
    title: 'Thérapeute spécialisée en relations humaines',
    institution: 'CFPRH — Centre de formation professionnel en relation humaine',
  },
  {
    title: 'Coaching relationnel de couples',
    institution: 'CFPRH — Centre de formation professionnel en relation humaine',
  },
  {
    title: 'La thérapie Internationale Imago',
    institution: null,
  },
  {
    title: 'Les neurosciences appliquées au couple',
    institution: null,
  },
  {
    title: 'Formateur Parent Guide Parent Complice',
    institution: null,
  },
]
</script>
