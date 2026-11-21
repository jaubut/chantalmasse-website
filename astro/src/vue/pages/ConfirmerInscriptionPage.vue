<template>
  <div class="min-h-dvh bg-background flex items-center justify-center px-8">
    <div class="text-center max-w-lg">
      <h1 class="font-headline italic text-4xl text-primary mb-4">Confirmer votre inscription</h1>

      <div role="status" aria-live="polite">
        <template v-if="state === 'pending'" />

        <template v-else-if="state === 'opted_out'">
          <p class="text-on-surface-variant font-light leading-relaxed mb-8">
            Vous vous étiez désabonné·e de l'infolettre. Pour vous réinscrire, écrivez à Chantal :
            <a href="mailto:chantal.gmasse@gmail.com" class="text-primary underline underline-offset-2">chantal.gmasse@gmail.com</a>.
          </p>
          <a href="/" class="inline-block bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors">
            Retour à l'accueil
          </a>
        </template>

        <template v-else-if="state === 'invalid'">
          <p class="text-on-surface-variant font-light leading-relaxed mb-8">
            Ce lien de confirmation est invalide ou expiré. Inscrivez-vous de nouveau pour recevoir un nouveau lien.
          </p>
          <a href="/" class="inline-block bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors">
            Retour à l'accueil
          </a>
        </template>

        <template v-else>
          <p class="text-on-surface-variant font-light leading-relaxed mb-8">
            Un dernier clic pour recevoir l'infolettre de Chantal Massé.
          </p>
          <button
            type="button"
            :disabled="state === 'loading'"
            :aria-busy="state === 'loading'"
            class="w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors disabled:opacity-50"
            @click="confirm"
          >
            {{ state === 'loading' ? 'Confirmation…' : 'Confirmer mon inscription' }}
          </button>
          <p v-if="error" role="alert" class="mt-4 text-sm text-red-600">{{ error }}</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ofetch } from 'ofetch'

// The confirmation email links here with the token in the fragment (#t=…), so it
// never reaches a server log. Nothing is sent until the button is clicked: link
// scanners that open the page can't confirm on the subscriber's behalf.
const token = ref('')
const state = ref<'pending' | 'idle' | 'loading' | 'opted_out' | 'invalid'>('pending')
const error = ref('')

onMounted(() => {
  token.value = new URLSearchParams(window.location.hash.slice(1)).get('t') ?? ''
  if (token.value) history.replaceState(history.state, '', window.location.pathname + window.location.search)
  state.value = token.value ? 'idle' : 'invalid'
})

async function confirm() {
  error.value = ''
  state.value = 'loading'
  try {
    const { result } = await ofetch<{ result: string }>('/api/newsletter/confirm', { method: 'POST', body: { token: token.value } })
    if (result === 'confirmed') return window.location.assign('/inscription-confirmee')
    state.value = result === 'opted_out' ? 'opted_out' : 'invalid'
  } catch {
    state.value = 'idle'
    error.value = 'Une erreur est survenue. Réessayez.'
  }
}
</script>
