<template>
  <div class="px-2">
    <h2 class="font-headline text-3xl italic text-primary text-center mb-10">
      Quel accompagnement souhaitez-vous?
    </h2>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <button
        v-for="service in services"
        :key="service.id"
        class="group text-left p-8 rounded-[1.5rem] border-2 transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="[
          service.id === 'individual'
            ? 'bg-surface-container-low border-outline-variant/30 hover:border-primary hover:bg-primary-fixed'
            : 'bg-surface-container-low border-outline-variant/30 hover:border-secondary hover:bg-secondary-fixed',
        ]"
        @click="$emit('select', service)"
      >
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300"
          :class="service.id === 'individual' ? 'bg-primary-fixed group-hover:bg-primary/10' : 'bg-secondary-fixed group-hover:bg-secondary/10'"
        >
          <Icon
            :icon="service.icon"
            class="text-2xl"
            :class="service.id === 'individual' ? 'text-primary' : 'text-secondary'"
          />
        </div>

        <div class="flex items-center gap-3 mb-3">
          <h3 class="font-headline text-xl text-on-surface">{{ service.name }}</h3>
          <span
            class="text-xs font-body font-semibold px-3 py-1 rounded-full"
            :class="service.id === 'individual' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'"
          >
            {{ service.duration }}
          </span>
        </div>

        <p class="font-body text-on-surface-variant font-light text-sm leading-relaxed">
          {{ service.description }}
        </p>

        <div
          class="mt-6 flex items-center gap-2 text-sm font-semibold transition-colors duration-300"
          :class="service.id === 'individual' ? 'text-primary' : 'text-secondary'"
        >
          Choisir ce service
          <Icon icon="material-symbols:arrow-forward" class="text-base" />
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

export interface BookingService {
  id: string
  name: string
  duration: string
  durationMinutes: number
  description: string
  icon: string
  colorId: string
}

defineEmits<{
  select: [service: BookingService]
}>()

const services: BookingService[] = [
  {
    id: 'individual',
    name: 'Thérapie Individuelle',
    duration: '60 minutes',
    durationMinutes: 60,
    description: 'Un espace sécurisant pour explorer vos émotions et initier un changement profond.',
    icon: 'material-symbols:person',
    colorId: '2',
  },
  {
    id: 'couple',
    name: 'Coaching de Couple',
    duration: '90 minutes',
    durationMinutes: 90,
    description: 'Un dialogue intentionnel pour transformer les conflits en opportunités de connexion.',
    icon: 'material-symbols:favorite',
    colorId: '7',
  },
]
</script>
