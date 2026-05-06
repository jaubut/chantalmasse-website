<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="close"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-[#1d1b19]/60 backdrop-blur-sm" @click="close" />

        <!-- Card -->
        <div
          class="relative z-10 w-full max-w-lg bg-surface rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Me contacter"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-8 pt-8 pb-2">
            <h2 class="font-headline italic text-2xl text-primary">Me contacter</h2>
            <button
              class="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container transition-colors text-on-surface-variant"
              aria-label="Fermer"
              @click="close"
            >
              <Icon icon="material-symbols:close" class="text-lg" />
            </button>
          </div>

          <p class="px-8 text-sm text-on-surface-variant">
            Une question, un besoin d'information? Écris-moi et je te reviens dans les 24h.
          </p>

          <!-- Form -->
          <form class="px-8 pt-6 pb-8 flex flex-col gap-4" @submit.prevent="handleSubmit">
            <div>
              <label for="contact-name" class="block text-xs uppercase tracking-wide text-on-surface-variant mb-1.5">Nom</label>
              <input
                id="contact-name"
                v-model="form.name"
                type="text"
                required
                maxlength="120"
                class="w-full px-4 py-3 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                placeholder="Ton nom"
              />
            </div>

            <div>
              <label for="contact-email" class="block text-xs uppercase tracking-wide text-on-surface-variant mb-1.5">Courriel ou téléphone</label>
              <input
                id="contact-email"
                v-model="form.contact"
                type="text"
                required
                maxlength="160"
                class="w-full px-4 py-3 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                placeholder="courriel@exemple.com ou 450-555-1234"
              />
            </div>

            <div>
              <label for="contact-message" class="block text-xs uppercase tracking-wide text-on-surface-variant mb-1.5">Message</label>
              <textarea
                id="contact-message"
                v-model="form.message"
                required
                rows="4"
                maxlength="4000"
                class="w-full px-4 py-3 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                placeholder="Comment puis-je t'aider?"
              />
            </div>

            <!-- Honeypot -->
            <input v-model="form.website" type="text" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />

            <!-- Error -->
            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

            <!-- Success -->
            <div v-if="sent" class="flex items-center gap-2 text-sm text-primary">
              <Icon icon="material-symbols:check-circle" class="text-lg" />
              <span>Message envoyé! Je te reviens bientôt.</span>
            </div>

            <button
              v-if="!sent"
              type="submit"
              :disabled="sending"
              class="w-full bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ sending ? 'Envoi en cours...' : 'Envoyer' }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { isOpen, close } = useContact()
const { trackContactSubmit } = useTracking()

const form = reactive({
  name: '',
  contact: '',
  message: '',
  website: '', // honeypot
})

const sending = ref(false)
const sent = ref(false)
const error = ref('')

async function handleSubmit() {
  if (form.website) return // honeypot triggered

  sending.value = true
  error.value = ''

  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        contact: form.contact.trim(),
        message: form.message.trim(),
        website: form.website,
      },
    })
    sent.value = true
    trackContactSubmit()
  } catch {
    error.value = 'Une erreur est survenue. Tu peux aussi m\'écrire directement à chantal.gmasse@gmail.com'
  } finally {
    sending.value = false
  }
}

watch(isOpen, (open) => {
  if (open) {
    sent.value = false
    error.value = ''
    form.name = ''
    form.contact = ''
    form.message = ''
    form.website = ''
  }
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: translateY(1rem) scale(0.98);
  opacity: 0;
}
.modal-leave-to .relative {
  transform: translateY(1rem) scale(0.98);
  opacity: 0;
}
</style>
