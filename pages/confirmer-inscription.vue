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
          <NuxtLink to="/" class="inline-block bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors">
            Retour à l'accueil
          </NuxtLink>
        </template>

        <template v-else-if="state === 'invalid'">
          <p class="text-on-surface-variant font-light leading-relaxed mb-8">
            Ce lien de confirmation est invalide ou expiré. Inscrivez-vous de nouveau pour recevoir un nouveau lien.
          </p>
          <NuxtLink to="/" class="inline-block bg-primary text-on-primary px-8 py-4 rounded-xl font-semibold hover:bg-primary-container transition-colors">
            Retour à l'accueil
          </NuxtLink>
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
// The confirmation email links here with the token in the fragment (#t=…), so it
// never reaches a server log. Nothing is sent until the button is clicked: link
// scanners that open the page can't confirm on the subscriber's behalf.
const route = useRoute()
const router = useRouter()
const token = ref('')
const state = ref<'pending' | 'idle' | 'loading' | 'opted_out' | 'invalid'>('pending')
const error = ref('')

onMounted(() => {
  token.value = new URLSearchParams(location.hash.slice(1)).get('t') ?? ''
  state.value = token.value ? 'idle' : 'invalid'
  // Drop the token from the address bar and history (through the router, which owns the URL).
  router.replace({ path: route.path, hash: '' })
})

async function confirm() {
  error.value = ''
  state.value = 'loading'
  try {
    const { result } = await $fetch<{ result: string }>('/api/newsletter/confirm', { method: 'POST', body: { token: token.value } })
    if (result === 'confirmed') return navigateTo('/inscription-confirmee')
    state.value = result === 'opted_out' ? 'opted_out' : 'invalid'
  } catch (e: any) {
    state.value = 'idle'
    error.value = e?.data?.statusMessage ?? 'Une erreur est survenue. Réessayez.'
  }
}

useSeoMeta({
  title: 'Confirmer votre inscription — Chantal Massé',
  robots: 'noindex',
})
</script>
