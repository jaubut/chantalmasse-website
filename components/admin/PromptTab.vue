<script setup lang="ts">
import { SYSTEM_PROMPT } from '~/utils/agentPrompt'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const promptSaved = ref(false)
const promptReset = ref(false)

function savePrompt() {
  if (!import.meta.client) return
  localStorage.setItem('cm_system_prompt', props.modelValue)
  promptSaved.value = true
  setTimeout(() => { promptSaved.value = false }, 2000)
}

function resetPrompt() {
  emit('update:modelValue', SYSTEM_PROMPT)
  if (import.meta.client) localStorage.removeItem('cm_system_prompt')
  promptReset.value = true
  setTimeout(() => { promptReset.value = false }, 2000)
}
</script>

<template>
  <div>
    <h2 class="font-headline italic text-2xl text-primary mb-6">Prompt système de l'agent</h2>

    <textarea
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      class="w-full min-h-64 bg-[#1e1a17] text-[#e8ddd0] font-mono text-sm rounded-2xl p-6 border-none outline-none resize-y mb-4"
      spellcheck="false"
    />

    <div class="flex flex-wrap gap-3 mb-6">
      <button
        @click="savePrompt"
        class="bg-primary text-on-primary px-5 py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition duration-200"
      >
        {{ promptSaved ? '✓ Sauvegardé!' : 'Sauvegarder le prompt' }}
      </button>
      <button
        @click="resetPrompt"
        class="bg-surface border border-outline-variant/20 text-primary px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-surface-container-low transition duration-200"
      >
        {{ promptReset ? '✓ Réinitialisé!' : 'Réinitialiser' }}
      </button>
    </div>

    <div class="bg-primary-fixed rounded-2xl p-5">
      <p class="font-semibold text-primary mb-2">💡 Comment faire évoluer ce prompt</p>
      <p class="text-primary/80 text-sm leading-relaxed">
        Ajoutez chaque semaine vos apprentissages de performance. Exemple: <em>"Les Reels publiés le mardi à 19h surperforment systématiquement les autres créneaux — prioriser ce créneau."</em> L'agent devient plus précis à chaque semaine de données réelles.
      </p>
    </div>
  </div>
</template>
