<template>
  <nav
    :class="[
      'fixed top-0 left-0 right-0 z-50 transition-shadow duration-300',
      scrolled ? 'shadow-md' : '',
    ]"
    style="background-color: rgba(254, 248, 243, 0.8); backdrop-filter: blur(12px);"
  >
    <div class="max-w-screen-xl mx-auto px-8 py-4 flex items-center justify-between">
      <!-- Logo -->
      <a href="/" class="font-headline italic text-2xl text-primary">
        Chantal Massé
      </a>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-10">
        <a href="#services" class="font-headline italic font-light text-on-surface hover:text-secondary transition-colors">Services</a>
        <a href="#approche" class="font-headline italic font-light text-on-surface hover:text-secondary transition-colors">Approche</a>
        <NuxtLink to="/blog" class="font-headline italic font-light text-on-surface hover:text-secondary transition-colors">Blog</NuxtLink>
      </div>

      <!-- CTA -->
      <div class="hidden md:block">
        <a href="#booking" class="bg-primary text-on-primary px-8 py-3 rounded-xl font-semibold hover:bg-primary-container transition-colors">
          Contact
        </a>
      </div>

      <!-- Hamburger -->
      <button class="md:hidden p-2" @click="menuOpen = !menuOpen" aria-label="Menu">
        <Icon :icon="menuOpen ? 'material-symbols:close' : 'material-symbols:menu'" class="text-2xl text-primary" />
      </button>
    </div>

    <!-- Mobile drawer -->
    <div v-if="menuOpen" class="md:hidden bg-surface-container-low px-8 py-6 flex flex-col gap-6 border-t border-outline-variant/30">
      <a href="#services" class="font-headline italic text-lg text-on-surface" @click="menuOpen = false">Services</a>
      <a href="#approche" class="font-headline italic text-lg text-on-surface" @click="menuOpen = false">Approche</a>
      <NuxtLink to="/blog" class="font-headline italic text-lg text-on-surface" @click="menuOpen = false">Blog</NuxtLink>
      <a href="#booking" class="bg-primary text-on-primary px-8 py-3 rounded-xl font-semibold text-center" @click="menuOpen = false">Contact</a>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const menuOpen = ref(false)
const scrolled = ref(false)

onMounted(() => {
  window.addEventListener('scroll', () => {
    scrolled.value = window.scrollY > 20
  })
})
</script>
