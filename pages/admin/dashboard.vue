<script setup lang="ts">
import { SYSTEM_PROMPT } from '~/utils/agentPrompt'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { logout } = useAdmin()

const activeTab = ref<'dashboard' | 'brief' | 'architecture' | 'prompt'>('dashboard')
const showMetaSetupModal = ref(false)
const systemPromptText = ref(SYSTEM_PROMPT)

onMounted(() => {
  if (!import.meta.client) return
  try {
    const saved = localStorage.getItem('cm_system_prompt')
    if (saved) systemPromptText.value = saved
  } catch { /* ignore */ }
})
</script>

<template>
  <div class="min-h-screen bg-background font-body">

    <!-- ── Admin Nav ── -->
    <nav class="bg-surface border-b border-outline-variant/20 px-8 py-4 sticky top-0 z-50">
      <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <span class="font-headline italic text-primary text-lg whitespace-nowrap hidden sm:block">
          Chantal Massé — Marketing
        </span>
        <span class="font-headline italic text-primary text-base whitespace-nowrap sm:hidden">
          CM Admin
        </span>

        <div class="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
            @click="activeTab = 'dashboard'"
            :class="activeTab === 'dashboard' ? 'bg-primary text-on-primary' : 'text-primary/60 hover:text-primary'"
            class="px-4 py-2 font-semibold text-sm whitespace-nowrap transition duration-200 rounded-xl"
          >
            📊 Aperçu
          </button>
          <button
            @click="activeTab = 'brief'"
            :class="activeTab === 'brief' ? 'bg-primary text-on-primary' : 'text-primary/60 hover:text-primary'"
            class="px-4 py-2 font-semibold text-sm whitespace-nowrap transition duration-200 rounded-xl"
          >
            ✨ Brief
          </button>
          <button
            @click="activeTab = 'architecture'"
            :class="activeTab === 'architecture' ? 'bg-primary text-on-primary' : 'text-primary/60 hover:text-primary'"
            class="px-4 py-2 font-semibold text-sm whitespace-nowrap transition duration-200 rounded-xl"
          >
            🏗 Architecture
          </button>
          <button
            @click="activeTab = 'prompt'"
            :class="activeTab === 'prompt' ? 'bg-primary text-on-primary' : 'text-primary/60 hover:text-primary'"
            class="px-4 py-2 font-semibold text-sm whitespace-nowrap transition duration-200 rounded-xl"
          >
            🤖 Prompt
          </button>
        </div>

        <button
          @click="logout()"
          class="text-primary/60 hover:text-primary text-sm font-semibold transition duration-200 whitespace-nowrap"
        >
          Se déconnecter
        </button>
      </div>
    </nav>

    <!-- ── Main Content ── -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <AdminInsightsTab v-show="activeTab === 'dashboard'" />
      <AdminBriefTab v-show="activeTab === 'brief'" :system-prompt="systemPromptText" />
      <AdminArchitectureTab v-show="activeTab === 'architecture'" />
      <AdminPromptTab v-show="activeTab === 'prompt'" v-model="systemPromptText" />
    </div>

    <AdminMetaSetupModal v-model="showMetaSetupModal" />

  </div>
</template>
