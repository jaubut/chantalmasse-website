<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!password.value) return
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/admin/auth', {
      method: 'POST',
      body: { password: password.value },
    })
    await navigateTo('/admin/dashboard')
  } catch {
    error.value = 'Mot de passe incorrect'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <!-- Lock icon -->
      <div class="flex justify-center mb-6">
        <div class="w-14 h-14 bg-primary-fixed rounded-full flex items-center justify-center">
          <span class="material-symbols-outlined text-primary text-2xl">lock</span>
        </div>
      </div>

      <!-- Card -->
      <div class="bg-surface p-8 rounded-[2rem] editorial-shadow">

        <!-- Logo -->
        <div class="text-center mb-8">
          <p class="font-headline italic text-primary text-2xl leading-tight">Chantal Massé</p>
          <p class="font-body text-on-surface-variant text-sm mt-1">Espace Administration</p>
        </div>

        <!-- Heading -->
        <h1 class="font-headline italic text-3xl text-primary text-center mb-6">
          Connexion
        </h1>

        <!-- Form -->
        <form class="space-y-4" @submit.prevent="handleLogin">
          <div>
            <input
              v-model="password"
              type="password"
              placeholder="Mot de passe"
              autocomplete="current-password"
              class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-5 py-4 font-body text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
            />
            <p v-if="error" class="font-body text-red-500 text-sm mt-2">{{ error }}</p>
          </div>

          <button
            type="submit"
            :disabled="loading || !password"
            class="w-full bg-primary text-on-primary py-4 rounded-xl font-body font-semibold text-lg hover:opacity-90 disabled:opacity-50 transition-all duration-200"
          >
            {{ loading ? 'Connexion…' : 'Accéder →' }}
          </button>
        </form>

      </div>
    </div>
  </div>
</template>
