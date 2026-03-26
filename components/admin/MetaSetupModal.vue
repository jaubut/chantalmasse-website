<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="bg-surface rounded-[2rem] p-8 max-w-md w-full editorial-shadow max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-headline italic text-xl text-primary">Configuration Meta</h3>
          <button @click="$emit('update:modelValue', false)" class="text-outline hover:text-primary text-xl transition duration-200">✕</button>
        </div>
        <ol class="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          <li class="flex gap-3">
            <span class="bg-primary text-on-primary w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full">1</span>
            <span>Allez sur <strong>developers.facebook.com</strong> et créez une nouvelle App (type: Business)</span>
          </li>
          <li class="flex gap-3">
            <span class="bg-primary text-on-primary w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full">2</span>
            <span>Ajoutez les produits <strong>Instagram Graph API</strong> et <strong>Pages API</strong></span>
          </li>
          <li class="flex gap-3">
            <span class="bg-primary text-on-primary w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full">3</span>
            <span>Dans Graph API Explorer, générez un token avec les permissions: <code class="bg-surface-container-high px-1 rounded text-xs">instagram_basic, instagram_manage_insights, pages_read_engagement</code></span>
          </li>
          <li class="flex gap-3">
            <span class="bg-primary text-on-primary w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full">4</span>
            <span>Échangez pour un token long-lived (60 jours) et ajoutez-le dans <code class="bg-surface-container-high px-1 rounded text-xs">.env</code> comme <code class="bg-surface-container-high px-1 rounded text-xs">META_ACCESS_TOKEN</code></span>
          </li>
          <li class="flex gap-3">
            <span class="bg-primary text-on-primary w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full">5</span>
            <span>Récupérez votre <code class="bg-surface-container-high px-1 rounded text-xs">META_IG_USER_ID</code> via <code class="bg-surface-container-high px-1 rounded text-xs">GET /me/accounts</code> puis relancez le serveur</span>
          </li>
        </ol>
        <button
          @click="$emit('update:modelValue', false)"
          class="mt-6 w-full bg-primary text-on-primary py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition duration-200"
        >
          Compris
        </button>
      </div>
    </div>
  </Teleport>
</template>
