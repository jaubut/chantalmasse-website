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

        <!-- Couple Coaching -->
        <div class="group bg-surface-container-lowest p-12 rounded-[2.5rem] editorial-shadow hover:-translate-y-2 transition-transform duration-300" data-animate>
          <div class="w-14 h-14 bg-secondary-fixed rounded-xl flex items-center justify-center mb-8">
            <Icon icon="material-symbols:favorite" class="text-2xl text-secondary" />
          </div>
          <h3 class="font-headline text-3xl text-primary mb-2">Coaching de Couple</h3>
          <p class="font-headline italic text-on-surface-variant mb-6">90 minutes de dialogue</p>
          <p class="text-on-surface-variant font-light mb-6">
            Une méthode structurée pour transformer les conflits répétitifs en opportunités de connexion profonde.
          </p>
          <ul class="space-y-3 mb-10">
            <li class="flex items-center gap-3 text-on-surface-variant font-light">
              <Icon icon="material-symbols:check-circle" class="text-lg text-secondary" />
              Dialogue intentionnel Imago
            </li>
            <li class="flex items-center gap-3 text-on-surface-variant font-light">
              <Icon icon="material-symbols:check-circle" class="text-lg text-secondary" />
              Outils de communication concrets
            </li>
          </ul>
          <div class="flex flex-col gap-3">
            <button
              class="w-full bg-secondary text-on-secondary py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              @click="booking.open()"
            >
              Prendre rendez-vous
            </button>
            <NuxtLink
              to="/coaching-de-couple"
              class="block w-full border border-outline-variant py-3 rounded-xl text-center text-on-surface-variant font-light text-sm hover:bg-surface-container transition-colors"
            >
              Découvrir le coaching de couple
            </NuxtLink>
          </div>
        </div>

        <!-- Individual Therapy -->
        <div class="group bg-primary p-12 rounded-[2.5rem] editorial-shadow hover:-translate-y-2 transition-transform duration-300" data-animate>
          <div class="w-14 h-14 bg-primary-fixed rounded-xl flex items-center justify-center mb-8">
            <Icon icon="material-symbols:person" class="text-2xl text-primary" />
          </div>
          <h3 class="font-headline text-3xl text-on-primary mb-2">Thérapie Individuelle</h3>
          <p class="font-headline italic text-on-primary-container mb-6">60 minutes pour soi</p>
          <p class="text-on-primary-container font-light mb-6">
            Un espace sécurisé pour explorer vos patterns relationnels, vos blessures d'attachement et vos ressources intérieures.
          </p>
          <ul class="space-y-3 mb-10">
            <li class="flex items-center gap-3 text-on-primary-container font-light">
              <Icon icon="material-symbols:check-circle" class="text-lg text-on-primary" />
              Approche centrée sur la personne
            </li>
            <li class="flex items-center gap-3 text-on-primary-container font-light">
              <Icon icon="material-symbols:check-circle" class="text-lg text-on-primary" />
              Reçus d'assurance RITMA
            </li>
          </ul>
          <div class="flex flex-col gap-3">
            <button
              class="w-full bg-surface text-primary py-4 rounded-xl font-semibold hover:bg-primary-fixed transition-colors duration-300"
              @click="booking.open()"
            >
              Prendre rendez-vous
            </button>
            <NuxtLink
              to="/therapie-individuelle"
              class="block w-full border border-on-primary/20 py-3 rounded-xl text-center text-on-primary-container font-light text-sm hover:bg-on-primary/5 transition-colors"
            >
              Découvrir la thérapie individuelle
            </NuxtLink>
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- Couple Coaching Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showCoupleModal"
        class="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-start justify-center"
        @click.self="showCoupleModal = false"
      >
        <!-- Overlay -->
        <div class="fixed inset-0 bg-on-surface/60 backdrop-blur-sm" @click="showCoupleModal = false" />

        <!-- Card -->
        <div class="relative z-10 w-full max-w-xl bg-surface rounded-[2rem] shadow-2xl overflow-hidden my-8">

          <!-- Close button -->
          <button
            class="absolute top-4 right-4 w-9 h-9 rounded-full bg-on-surface/10 flex items-center justify-center hover:bg-on-surface/20 transition-colors z-10"
            @click="showCoupleModal = false"
          >
            <Icon icon="material-symbols:close" class="text-on-primary text-lg" />
          </button>

          <!-- Top accent -->
          <div class="bg-primary px-8 pt-8 pb-7">
            <div class="w-12 h-12 bg-secondary-fixed rounded-xl flex items-center justify-center mb-5">
              <Icon icon="material-symbols:favorite" class="text-2xl text-secondary" />
            </div>
            <h2 class="font-headline text-3xl italic text-on-primary leading-tight">
              Coaching de Couple
            </h2>
            <p class="font-headline italic text-on-primary-container mt-1">90 minutes de dialogue</p>
          </div>

          <!-- Body -->
          <div class="px-8 py-7 space-y-5">
            <p class="text-on-surface-variant font-light leading-relaxed">
              Chaque individu au sein du couple porte en lui un vécu relationnel plus ou moins souffrant. Déceptions, besoins non comblés, insatisfactions et aspirations. De ce vécu relationnel souffrant, prend source les conflits au sein du couple. N'étant pas conscient de ce qui se passe en nous ou/et comment le communiquer à notre conjoint, la majorité des conflits proviennent d'une mauvaise communication.
            </p>
            <p class="text-on-surface-variant font-light leading-relaxed">
              Le coaching est une approche orientée vers la solution, qui permet aux couples d'être accompagnés vers l'atteinte de leurs objectifs. Au cours de chaque rencontre, le couple est appelé au travers de différents outils, à entrer en relation (se faire connaître l'un à l'autre) et non en réaction (attaque ou fuite) et ainsi décider ensemble des actions à mettre en place pour combler les besoins de chacun et retrouver complicité, harmonie et épanouissement.
            </p>
            <p class="font-headline italic text-primary text-lg leading-snug">
              Ce n'est pas un manque d'amour qui sépare un couple, mais un manque d'outils.
            </p>
          </div>

          <!-- Footer -->
          <div class="px-8 pb-8 flex items-center justify-end">
            <button
              class="bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              @click="showCoupleModal = false; booking.open()"
            >
              Réserver une séance →
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Individual Therapy Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showIndividualModal"
        class="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-start justify-center"
        @click.self="showIndividualModal = false"
      >
        <!-- Overlay -->
        <div class="fixed inset-0 bg-on-surface/60 backdrop-blur-sm" @click="showIndividualModal = false" />

        <!-- Card -->
        <div class="relative z-10 w-full max-w-xl bg-surface rounded-[2rem] shadow-2xl overflow-hidden my-8">

          <!-- Close button -->
          <button
            class="absolute top-4 right-4 w-9 h-9 rounded-full bg-on-surface/10 flex items-center justify-center hover:bg-on-surface/20 transition-colors z-10"
            @click="showIndividualModal = false"
          >
            <Icon icon="material-symbols:close" class="text-primary text-lg" />
          </button>

          <!-- Top accent -->
          <div class="bg-primary-fixed px-8 pt-8 pb-7">
            <div class="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-5">
              <Icon icon="material-symbols:person" class="text-2xl text-on-primary" />
            </div>
            <h2 class="font-headline text-3xl italic text-primary leading-tight">
              Thérapie Individuelle
            </h2>
            <p class="font-headline italic text-on-surface-variant mt-1">60 minutes pour soi</p>
          </div>

          <!-- Body -->
          <div class="px-8 py-7 space-y-5">
            <p class="text-on-surface-variant font-light leading-relaxed">
              Une démarche thérapeutique permet la prise de conscience de ce qui se passe en vous et de ce qui entretient les insatisfactions de votre vie et ainsi cheminer vers un mieux-être. Plus on prend conscience de ce qui nous fait peur, nous dérange ou nous fait mal, plus on a la possibilité de faire des choix conscients, en fonction de nos besoins, et de reprendre confiance en nous à l'égard de vivre votre vie.
            </p>
            <p class="text-on-surface-variant font-light leading-relaxed">
              L'espace thérapeutique permet de s'exprimer en toute sécurité et ainsi cheminer vers une plus grande connaissance et compréhension de son fonctionnement en relation avec soi et les autres. C'est un endroit pour exister, communiquer et grandir. Vous avez besoin d'être entendu sans jugement dans ce qui est précieux ou souffrant pour vous? Je vous accompagne!
            </p>
          </div>

          <!-- Footer -->
          <div class="px-8 pb-8 flex items-center justify-end">
            <button
              class="bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              @click="showIndividualModal = false; booking.open()"
            >
              Réserver une séance →
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const showIndividualModal = ref(false)
const showCoupleModal = ref(false)
const booking = useBooking()
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease-out;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: scale(0.96);
}
.modal-leave-to .relative {
  transform: scale(0.96);
}
</style>
