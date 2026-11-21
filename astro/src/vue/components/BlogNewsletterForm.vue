<template>
  <!-- Newsletter -->
          <div class="bg-white/10 rounded-[2rem] p-6 md:p-10">
            <p class="text-primary-fixed-dim text-sm uppercase tracking-widest font-light mb-3">Infolettre</p>
            <h3 class="font-headline text-3xl italic text-white mb-3 leading-snug">Pensées & Réflexions</h3>
            <p class="text-primary-fixed-dim font-light mb-8">
              Recevez mensuellement des pistes de réflexion et des ressources pour nourrir vos relations.
            </p>
            <form class="flex flex-col gap-4" @submit.prevent="subscribe">
              <label for="blog-newsletter-email" class="sr-only">Courriel</label>
              <input
                id="blog-newsletter-email"
                v-model="email"
                type="email"
                required
                autocomplete="email"
                maxlength="254"
                placeholder="votre@courriel.com"
                :disabled="loading || success"
                class="bg-white/15 text-white rounded-xl px-5 py-4 outline-hidden placeholder-white/40 focus:ring-2 focus:ring-primary-fixed/50 disabled:opacity-50"
              />
              <button
                type="submit"
                :disabled="loading || success"
                class="bg-primary-fixed text-primary px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
              >
                {{ success ? 'Envoyé ✓' : loading ? '...' : "S'abonner" }}
              </button>
              <input v-model="website" type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <p class="text-sm text-primary-fixed-dim font-light">
                {{ NEWSLETTER_CONSENT_TEXT }}
                <a href="/confidentialite-infolettre" class="inline-block py-2 underline underline-offset-2">Confidentialité</a>
              </p>
            </form>
            <p role="status" aria-live="polite" class="mt-3 text-sm text-primary-fixed">{{ success ? NEWSLETTER_SUCCESS : '' }}</p>
            <p v-if="error" role="alert" class="mt-3 text-sm text-red-300">{{ error }}</p>
          </div>
</template>

<script setup lang="ts">
// The newsletter box of pages/blog/[slug].vue, as an island (same form, same endpoint, same messages).
import { ref } from 'vue'
import { ofetch } from 'ofetch'
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_SUCCESS } from '~/utils/newsletterConsent'

const email = ref('')
const website = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function subscribe(): Promise<void> {
  error.value = ''
  loading.value = true
  try {
    await ofetch('/api/newsletter/subscribe', { method: 'POST', body: { email: email.value.trim(), website: website.value } })
    success.value = true
    email.value = ''
  } catch (e: unknown) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Une erreur est survenue. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>
