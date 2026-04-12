<template>
  <nav
    :class="[
      'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
      scrolled ? 'shadow-md' : '',
    ]"
    :style="navStyle"
  >
    <div class="max-w-screen-xl mx-auto px-8 py-4 flex items-center justify-between">
      <!-- Logo -->
      <NuxtLink to="/" :class="['font-headline italic text-2xl transition-colors duration-500', isJourney ? 'text-white' : 'text-primary']">
        Chantal Massé
      </NuxtLink>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-10">
        <a v-for="link in navLinks" :key="link.label" :href="link.href" :class="linkClass">{{ link.label }}</a>
        <NuxtLink to="/blog" :class="linkClass">Blog</NuxtLink>
      </div>

      <!-- Socials + CTA -->
      <div class="hidden md:flex items-center gap-3">
        <a href="https://www.facebook.com/chantalmassetherapeute" target="_blank" rel="noopener" aria-label="Facebook" :class="['flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300', socialClass]" :style="socialBgStyle">
          <Icon icon="mdi:facebook" class="text-lg transition-colors duration-500" :style="{ color: isJourney ? 'rgba(255,255,255,0.6)' : 'rgba(23,48,40,0.3)' }" />
        </a>
        <a href="https://www.instagram.com/chantalmassetherapeute" target="_blank" rel="noopener" aria-label="Instagram" :class="['flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300', socialClass]" :style="socialBgStyle">
          <Icon icon="mdi:instagram" class="text-lg transition-colors duration-500" :style="{ color: isJourney ? 'rgba(255,255,255,0.6)' : 'rgba(23,48,40,0.3)' }" />
        </a>
        <button :class="ctaClass" class="ml-2 px-8 py-3 rounded-xl font-semibold transition-all duration-500" @click="contact.open()">
          Me contacter
        </button>
      </div>

      <!-- Hamburger -->
      <button class="md:hidden p-2" @click="menuOpen = !menuOpen" aria-label="Menu">
        <Icon :icon="menuOpen ? 'material-symbols:close' : 'material-symbols:menu'" class="text-2xl transition-colors duration-500" :class="isJourney ? 'text-white' : 'text-primary'" />
      </button>
    </div>

    <!-- Mobile drawer -->
    <div v-if="menuOpen" :class="['md:hidden px-8 py-6 flex flex-col gap-6 border-t transition-colors duration-500', isJourney ? 'border-white/10' : 'border-outline-variant/30']" :style="drawerStyle">
      <a v-for="link in navLinks" :key="link.label" :href="link.href" :class="mobileLinkClass" @click="menuOpen = false">{{ link.label }}</a>
      <NuxtLink to="/blog" :class="mobileLinkClass" @click="menuOpen = false">Blog</NuxtLink>
      <button :class="ctaClass" class="px-8 py-3 rounded-xl font-semibold text-center transition-all duration-500" @click="contact.open(); menuOpen = false">Me contacter</button>
      <div class="flex items-center gap-3">
        <a href="https://www.facebook.com/chantalmassetherapeutecoach" target="_blank" rel="noopener" aria-label="Facebook" class="flex items-center justify-center w-9 h-9 rounded-lg" :style="socialBgStyle">
          <Icon icon="mdi:facebook" class="text-lg transition-colors duration-500" :style="{ color: isJourney ? 'rgba(255,255,255,0.6)' : 'rgba(23,48,40,0.3)' }" />
        </a>
        <a href="https://www.instagram.com/chantalmasse_therapeute" target="_blank" rel="noopener" aria-label="Instagram" class="flex items-center justify-center w-9 h-9 rounded-lg" :style="socialBgStyle">
          <Icon icon="mdi:instagram" class="text-lg transition-colors duration-500" :style="{ color: isJourney ? 'rgba(255,255,255,0.6)' : 'rgba(23,48,40,0.3)' }" />
        </a>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const route = useRoute()
const contact = useContact()
const menuOpen = ref(false)
const scrolled = ref(false)

const isJourney = computed(() => route.path === '/journey')
const hasLocalAnchors = computed(() =>
  ['/', '/coaching-de-couple', '/therapie-individuelle'].includes(route.path),
)

const navLinks = computed(() => {
  const prefix = hasLocalAnchors.value ? '' : '/'
  return [
    { label: 'Services', href: `${prefix}#services` },
    { label: 'Approche', href: `${prefix}#approche` },
    { label: 'À propos', href: `${prefix}#apropos` },
  ]
})

const navStyle = computed(() => {
  if (isJourney.value) {
    if (scrolled.value) {
      return {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }
    }
    return {
      backgroundColor: 'transparent',
    }
  }
  return {
    backgroundColor: 'rgba(254, 248, 243, 0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }
})

const drawerStyle = computed(() => {
  if (isJourney.value) {
    return {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    }
  }
  return { backgroundColor: 'var(--color-surface-container-low, #f8f3ee)' }
})

const socialBgStyle = computed(() => {
  if (isJourney.value) return {}
  return { backgroundColor: 'rgba(23, 48, 40, 0.1)' }
})

const socialClass = computed(() =>
  isJourney.value ? 'nav-clay-icon' : '',
)

const linkClass = computed(() => [
  'font-headline italic font-light transition-colors duration-300',
  isJourney.value
    ? 'text-white/70 hover:text-white'
    : 'text-on-surface hover:text-secondary',
])

const mobileLinkClass = computed(() => [
  'font-headline italic text-lg transition-colors duration-300',
  isJourney.value ? 'text-white/80' : 'text-on-surface',
])

const ctaClass = computed(() =>
  isJourney.value
    ? 'nav-clay text-white'
    : 'bg-primary text-on-primary hover:bg-primary-container',
)

onMounted(() => {
  window.addEventListener('scroll', () => {
    scrolled.value = window.scrollY > 20
  })
})
</script>
