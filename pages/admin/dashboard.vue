<script setup lang="ts">
import { SYSTEM_PROMPT } from '~/utils/agentPrompt'

definePageMeta({ layout: 'admin', middleware: 'admin' })

// ─── State ───────────────────────────────────────────────────────────────────
const activeTab = ref<'dashboard' | 'brief' | 'architecture' | 'prompt'>('dashboard')
const { logout, fetchInsights, generateBrief } = useAdmin()

// Tab 1 – Insights
const insights = ref<any>(null)
const insightsLoading = ref(false)
const insightsError = ref(false)
const showMetaSetupModal = ref(false)

// Tab 2 – Brief
const briefState = ref<'empty' | 'loading' | 'generated'>('empty')
const currentBrief = ref<{ text: string; generatedAt: string } | null>(null)
const parsedBrief = ref<{ posts: any[]; strategicTip: string } | null>(null)
const briefHistory = ref<{ date: string; summary: string; fullText: string }[]>([])
const briefEmailSending = ref(false)
const briefEmailSent = ref(false)
const briefCopied = ref(false)

// Tab 4 – Prompt
const systemPromptText = ref(SYSTEM_PROMPT)
const promptSaved = ref(false)
const promptReset = ref(false)

// ─── Computed ────────────────────────────────────────────────────────────────
const currentMondayLabel = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  loadInsights()
  loadBriefHistory()
  loadSavedPrompt()
})

// ─── Insights ────────────────────────────────────────────────────────────────
async function loadInsights() {
  insightsLoading.value = true
  insightsError.value = false
  try {
    insights.value = await fetchInsights()
  } catch {
    insightsError.value = true
  } finally {
    insightsLoading.value = false
  }
}

// ─── Brief ───────────────────────────────────────────────────────────────────
async function handleGenerateBrief() {
  briefState.value = 'loading'
  briefEmailSent.value = false
  briefCopied.value = false
  try {
    const res = await generateBrief({
      action: 'generate',
      customPrompt: systemPromptText.value !== SYSTEM_PROMPT ? systemPromptText.value : undefined,
    }) as any
    currentBrief.value = { text: res.brief, generatedAt: res.generatedAt }
    parsedBrief.value = parseBrief(res.brief)
    briefState.value = 'generated'
    saveBriefToHistory(res.brief)
  } catch {
    briefState.value = 'empty'
  }
}

async function handleEmailBrief() {
  if (!currentBrief.value) return
  briefEmailSending.value = true
  try {
    await generateBrief({ action: 'email' })
    briefEmailSent.value = true
  } finally {
    briefEmailSending.value = false
  }
}

function copyBrief() {
  if (!currentBrief.value) return
  navigator.clipboard.writeText(currentBrief.value.text)
  briefCopied.value = true
  setTimeout(() => { briefCopied.value = false }, 2000)
}

function parseBrief(text: string): { posts: any[]; strategicTip: string } {
  const posts: any[] = []
  const blocks = text.split(/POST \d+:/i).filter(Boolean)

  for (const block of blocks) {
    const get = (field: string) => {
      const match = block.match(new RegExp(field + ':\\s*(.+)', 'i'))
      return match ? (match[1] ?? '').trim() : ''
    }
    posts.push({
      day: get('JOUR'),
      time: get('HEURE'),
      pillar: get('PILIER'),
      format: get('FORMAT'),
      hook: get('ACCROCHE'),
      why: get('POURQUOI'),
    })
  }

  const tipMatch = text.match(/CONSEIL STRATÉGIQUE:\s*([\s\S]+)/i)
  const strategicTip = tipMatch ? (tipMatch[1] ?? '').trim() : ''

  return { posts, strategicTip }
}

function pillarColor(pillar: string): string {
  const p = pillar?.toLowerCase() || ''
  if (p.includes('mythe') || p.includes('réalité')) return '#7B5EA7'
  if (p.includes('q&r') || p.includes('q&r') || p.includes('question')) return '#E07A5F'
  if (p.includes('défi') || p.includes('micro')) return '#3D9970'
  if (p.includes('réflexion') || p.includes('reflexion')) return '#C9A84C'
  return '#173028'
}

// ─── Brief history ───────────────────────────────────────────────────────────
function saveBriefToHistory(text: string) {
  if (!import.meta.client) return
  const entry = {
    date: new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    summary: text.slice(0, 100),
    fullText: text,
  }
  briefHistory.value.unshift(entry)
  if (briefHistory.value.length > 4) briefHistory.value = briefHistory.value.slice(0, 4)
  localStorage.setItem('cm_briefs', JSON.stringify(briefHistory.value))
}

function loadBriefHistory() {
  if (!import.meta.client) return
  try {
    const stored = localStorage.getItem('cm_briefs')
    if (stored) briefHistory.value = JSON.parse(stored)
  } catch { /* ignore */ }
}

function viewHistoricBrief(entry: { fullText: string; date: string }) {
  currentBrief.value = { text: entry.fullText, generatedAt: entry.date }
  parsedBrief.value = parseBrief(entry.fullText)
  briefState.value = 'generated'
  activeTab.value = 'brief'
}

// ─── Prompt ──────────────────────────────────────────────────────────────────
function loadSavedPrompt() {
  if (!import.meta.client) return
  try {
    const saved = localStorage.getItem('cm_system_prompt')
    if (saved) systemPromptText.value = saved
  } catch { /* ignore */ }
}

function savePrompt() {
  if (!import.meta.client) return
  localStorage.setItem('cm_system_prompt', systemPromptText.value)
  promptSaved.value = true
  setTimeout(() => { promptSaved.value = false }, 2000)
}

function resetPrompt() {
  systemPromptText.value = SYSTEM_PROMPT
  if (import.meta.client) localStorage.removeItem('cm_system_prompt')
  promptReset.value = true
  setTimeout(() => { promptReset.value = false }, 2000)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PILLARS = [
  { icon: '⚡', name: 'Mythe vs Réalité', format: 'Reel', tip: 'Déconstruire les idées reçues sur la thérapie. Fort potentiel viral.', color: '#7B5EA7' },
  { icon: '💬', name: 'Q&R Instagram', format: 'Story / Carrousel', tip: 'Segment "Demandez à la thérapeute". Booste l\'engagement direct.', color: '#E07A5F' },
  { icon: '📅', name: 'Micro-Défi', format: 'Carrousel', tip: 'Exercices concrets pour les couples. Très partageable.', color: '#3D9970' },
  { icon: '✨', name: 'Réflexions', format: 'Publication statique', tip: 'Citations et insights de couples anonymes. Renforce la confiance.', color: '#C9A84C' },
]

const pillarMetaMap: Record<string, string> = {
  myth: 'Mythe vs Réalité',
  challenge: 'Micro-Défi',
  qa: 'Q&R Instagram',
  reflection: 'Réflexions',
  general: 'Général',
}

const platformBadgeColors: Record<string, string> = {
  Instagram: '#E07A5F',
  Facebook: '#1877F2',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="min-h-screen bg-background font-body">

    <!-- ── Admin Nav ── -->
    <nav class="bg-surface border-b border-outline-variant/20 px-8 py-4 sticky top-0 z-50">
      <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <!-- Left: Logo -->
        <span class="font-headline italic text-primary text-lg whitespace-nowrap hidden sm:block">
          Chantal Massé — Marketing
        </span>
        <span class="font-headline italic text-primary text-base whitespace-nowrap sm:hidden">
          CM Admin
        </span>

        <!-- Center: Tabs -->
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

        <!-- Right: Logout -->
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

      <!-- ══════════════════════════════════════════════════════
           TAB 1 — TABLEAU DE BORD
           ══════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'dashboard'">

        <!-- Loading -->
        <div v-if="insightsLoading" class="space-y-4 animate-pulse">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div v-for="i in 4" :key="i" class="bg-surface rounded-2xl p-6 border border-outline-variant/20 h-28" />
          </div>
        </div>

        <!-- Mock data setup banner -->
        <div
          v-if="insights?.isMockData && !insightsLoading"
          class="bg-primary-fixed rounded-2xl p-6 mb-6 text-center"
        >
          <p class="text-primary font-semibold mb-3">
            🔌 Connectez votre compte Meta pour voir vos statistiques réelles.
          </p>
          <button
            @click="showMetaSetupModal = true"
            class="bg-primary text-on-primary px-5 py-2 text-sm font-semibold transition hover:opacity-90 rounded-xl"
          >
            Comment configurer →
          </button>
          <p class="text-primary/60 text-xs mt-2">Données fictives affichées pour démonstration</p>
        </div>

        <div v-if="insights && !insightsLoading">
          <!-- KPI Row -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div class="bg-surface rounded-2xl p-5 border border-outline-variant/20 editorial-shadow">
              <div class="text-2xl mb-2">📅</div>
              <div class="text-xs text-outline mb-1">Meilleur jour</div>
              <div class="text-xl font-semibold text-[#E07A5F]">{{ insights.bestDay }}</div>
            </div>
            <div class="bg-surface rounded-2xl p-5 border border-outline-variant/20 editorial-shadow">
              <div class="text-2xl mb-2">🎬</div>
              <div class="text-xs text-outline mb-1">Meilleur format</div>
              <div class="text-xl font-semibold text-[#7B5EA7]">{{ insights.bestFormat }}</div>
            </div>
            <div class="bg-surface rounded-2xl p-5 border border-outline-variant/20 editorial-shadow">
              <div class="text-2xl mb-2">📸</div>
              <div class="text-xs text-outline mb-1">Abonnés Instagram</div>
              <div class="text-xl font-semibold text-[#3D9970]">{{ insights.followers.instagram.toLocaleString('fr-CA') }}</div>
              <div class="text-xs text-[#3D9970] mt-0.5">{{ insights.followers.igGrowth }}</div>
            </div>
            <div class="bg-surface rounded-2xl p-5 border border-outline-variant/20 editorial-shadow">
              <div class="text-2xl mb-2">👥</div>
              <div class="text-xs text-outline mb-1">Abonnés Facebook</div>
              <div class="text-xl font-semibold text-[#C9A84C]">{{ insights.followers.facebook.toLocaleString('fr-CA') }}</div>
            </div>
          </div>

          <!-- Last week's posts -->
          <div class="mb-8">
            <h2 class="font-headline italic text-xl text-primary mb-4">
              Publications de la semaine
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                v-for="post in insights.posts"
                :key="post.id"
                class="flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden editorial-shadow"
              >
                <!-- Colored top band (like blog image) -->
                <div
                  class="h-20 flex items-center justify-center"
                  :style="{ backgroundColor: pillarColor(pillarMetaMap[post.pillar] || '') + '1A' }"
                >
                  <div
                    class="w-12 h-12 flex items-center justify-center text-2xl text-white rounded-2xl"
                    :style="{ backgroundColor: pillarColor(pillarMetaMap[post.pillar] || '') }"
                  >
                    {{ post.pillar === 'myth' ? '⚡' : post.pillar === 'challenge' ? '📅' : post.pillar === 'qa' ? '💬' : '✨' }}
                  </div>
                </div>

                <!-- Content -->
                <div class="flex flex-col flex-1 p-5 gap-3">
                  <!-- Pillar + platform -->
                  <div class="flex items-center justify-between">
                    <span
                      class="text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full text-white"
                      :style="{ backgroundColor: pillarColor(pillarMetaMap[post.pillar] || '') }"
                    >
                      {{ pillarMetaMap[post.pillar] || post.pillar }}
                    </span>
                    <span
                      class="text-xs font-semibold text-white px-2 py-1 rounded-full"
                      :style="{ backgroundColor: platformBadgeColors[post.platform] || '#727975' }"
                    >
                      {{ post.platform }}
                    </span>
                  </div>

                  <!-- Type + day -->
                  <h3 class="font-headline italic text-primary text-lg leading-snug">
                    {{ post.type }} · {{ post.day }}
                  </h3>

                  <!-- Stats grid -->
                  <div class="grid grid-cols-2 gap-2 flex-1">
                    <div class="bg-background rounded-xl p-3">
                      <div class="text-xs text-outline mb-0.5">Portée</div>
                      <div class="font-semibold text-on-surface text-sm">{{ post.reach.toLocaleString('fr-CA') }}</div>
                    </div>
                    <div class="bg-background rounded-xl p-3">
                      <div class="text-xs text-outline mb-0.5">Engagement</div>
                      <div class="font-semibold text-on-surface text-sm">{{ post.engagement }}</div>
                    </div>
                    <div class="bg-background rounded-xl p-3">
                      <div class="text-xs text-outline mb-0.5">Sauvegardes</div>
                      <div class="font-semibold text-on-surface text-sm">{{ post.saves }}</div>
                    </div>
                    <div class="bg-background rounded-xl p-3">
                      <div class="text-xs text-outline mb-0.5">Taux</div>
                      <div class="font-semibold text-on-surface text-sm">{{ post.engagementRate }}</div>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div class="flex items-center justify-between pt-3 border-t border-outline-variant/30">
                    <span class="text-xs text-on-surface-variant font-light">{{ post.day }}</span>
                    <span class="text-primary text-sm font-semibold">{{ post.engagementRate }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Content Pillars -->
          <div>
            <h2 class="font-headline italic text-xl text-primary mb-4">
              Piliers de contenu
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                v-for="pillar in PILLARS"
                :key="pillar.name"
                class="rounded-2xl p-5 border"
                :style="{
                  backgroundColor: pillar.color + '1A',
                  borderColor: pillar.color + '4D',
                }"
              >
                <div class="text-2xl mb-2">{{ pillar.icon }}</div>
                <div class="font-semibold text-on-surface mb-0.5">{{ pillar.name }}</div>
                <div
                  class="text-xs font-semibold mb-2 inline-block px-2 py-0.5 rounded-full"
                  :style="{ backgroundColor: pillar.color + '33', color: pillar.color }"
                >
                  {{ pillar.format }}
                </div>
                <p class="text-sm text-on-surface-variant">{{ pillar.tip }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB 2 — BRIEF HEBDOMADAIRE
           ══════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'brief'">

        <!-- Top action bar -->
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 class="font-headline italic text-xl text-primary">
            Brief de la semaine du {{ currentMondayLabel }}
          </h2>
          <button
            @click="handleGenerateBrief"
            :disabled="briefState === 'loading'"
            class="bg-primary text-on-primary px-6 py-3 rounded-2xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition duration-200"
          >
            ✨ Générer le brief IA
          </button>
        </div>

        <!-- State: Empty -->
        <div v-if="briefState === 'empty'" class="text-center py-16">
          <div class="text-6xl mb-4">✨</div>
          <h3 class="font-headline italic text-2xl text-primary mb-2">
            Générez votre plan de publication hebdomadaire en un clic.
          </h3>
          <p class="text-outline mb-6 max-w-md mx-auto">
            L'agent analyse vos statistiques Meta et génère un plan concret basé sur vos 4 piliers de contenu.
          </p>
          <button
            @click="handleGenerateBrief"
            class="bg-primary text-on-primary px-6 py-3 rounded-2xl font-semibold text-sm hover:opacity-90 transition duration-200"
          >
            ✨ Générer le brief IA
          </button>
        </div>

        <!-- State: Loading -->
        <div v-if="briefState === 'loading'" class="bg-surface rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div class="h-1.5 bg-gradient-to-r from-primary to-secondary animate-pulse" />
          <div class="p-8 text-center">
            <div class="text-3xl mb-4">⏳</div>
            <p class="text-on-surface font-semibold mb-4">L'agent analyse vos statistiques…</p>
            <div class="space-y-2 max-w-sm mx-auto">
              <div class="h-3 bg-surface-container-high rounded animate-pulse" />
              <div class="h-3 bg-surface-container-high rounded animate-pulse w-4/5 mx-auto" />
              <div class="h-3 bg-surface-container-high rounded animate-pulse w-3/5 mx-auto" />
            </div>
            <p class="text-outline text-sm mt-4">Cela prend environ 10–15 secondes</p>
          </div>
        </div>

        <!-- State: Generated -->
        <div v-if="briefState === 'generated' && currentBrief" class="space-y-4">
          <div class="bg-surface rounded-2xl border border-outline-variant/20 p-8">
            <!-- Meta row -->
            <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
              <span class="text-xs text-outline">
                Généré le {{ formatDate(currentBrief.generatedAt) }}
              </span>
              <button
                @click="copyBrief"
                class="text-xs text-primary font-semibold hover:opacity-70 transition"
              >
                {{ briefCopied ? '✓ Copié!' : '📋 Copier' }}
              </button>
            </div>

            <!-- Post cards -->
            <div v-if="parsedBrief" class="space-y-4">
              <div
                v-for="(post, i) in parsedBrief.posts"
                :key="i"
                class="bg-background rounded-2xl p-5 border-l-4"
                :style="{ borderLeftColor: pillarColor(post.pillar) }"
              >
                <!-- Row 1: badges -->
                <div class="flex flex-wrap gap-2 mb-3">
                  <span class="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
                    {{ post.day }} · {{ post.time }}
                  </span>
                  <span
                    class="text-xs font-semibold px-3 py-1 text-white rounded-full"
                    :style="{ backgroundColor: pillarColor(post.pillar) }"
                  >
                    {{ post.pillar }}
                  </span>
                  <span class="bg-surface-container-high text-on-surface-variant text-xs font-semibold px-3 py-1 rounded-full">
                    {{ post.format }}
                  </span>
                </div>
                <!-- Row 2: hook -->
                <p class="font-headline italic text-primary text-base mb-2 leading-snug">
                  "{{ post.hook }}"
                </p>
                <!-- Row 3: why -->
                <p class="text-sm text-outline leading-relaxed">
                  <span class="font-semibold text-on-surface-variant">Pourquoi:</span> {{ post.why }}
                </p>
              </div>

              <!-- Strategic tip -->
              <div v-if="parsedBrief.strategicTip" class="bg-primary-fixed rounded-2xl p-5">
                <p class="font-semibold text-primary mb-1">💡 Conseil stratégique de la semaine</p>
                <p class="text-primary/80 text-sm leading-relaxed">{{ parsedBrief.strategicTip }}</p>
              </div>
            </div>

            <!-- Raw text fallback -->
            <div v-else class="whitespace-pre-wrap text-sm text-on-surface leading-relaxed">
              {{ currentBrief.text }}
            </div>
          </div>

          <!-- Action buttons -->
          <div class="flex flex-wrap gap-3">
            <button
              @click="copyBrief"
              class="flex items-center gap-2 bg-surface border border-outline-variant/20 text-primary px-5 py-3 rounded-2xl text-sm font-semibold hover:bg-surface-container-low transition duration-200"
            >
              📋 {{ briefCopied ? 'Copié!' : 'Copier le brief' }}
            </button>
            <button
              @click="handleEmailBrief"
              :disabled="briefEmailSending || briefEmailSent"
              class="flex items-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-2xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition duration-200"
            >
              {{ briefEmailSending ? '⏳ Envoi…' : briefEmailSent ? '✓ Envoyé!' : '📧 Envoyer par courriel à Chantal' }}
            </button>
          </div>
        </div>

        <!-- Brief history -->
        <div v-if="briefHistory.length > 0" class="mt-8">
          <h3 class="font-headline italic text-lg text-primary mb-3">Briefs précédents</h3>
          <div class="space-y-2">
            <button
              v-for="(entry, i) in briefHistory"
              :key="i"
              @click="viewHistoricBrief(entry)"
              class="w-full bg-surface border border-outline-variant/20 rounded-2xl p-4 text-left hover:bg-surface-container-low transition duration-200"
            >
              <div class="text-xs text-outline mb-1">{{ entry.date }}</div>
              <div class="text-sm text-on-surface truncate">{{ entry.summary }}…</div>
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB 3 — ARCHITECTURE
           ══════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'architecture'">
        <h2 class="font-headline italic text-2xl text-primary mb-6">Architecture du système</h2>

        <!-- Flow diagram -->
        <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6 mb-6 overflow-x-auto">
          <div class="flex items-center gap-3 min-w-max mx-auto w-fit">
            <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
              <div class="text-2xl mb-2">📊</div>
              <div class="font-semibold text-primary text-sm mb-1">Meta Graph API</div>
              <div class="text-xs text-outline">Instagram + Facebook</div>
            </div>
            <div class="text-outline-variant text-2xl">→</div>
            <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
              <div class="text-2xl mb-2">⚙️</div>
              <div class="font-semibold text-primary text-sm mb-1">Nuxt.js App</div>
              <div class="text-xs text-outline">Cron hebdomadaire</div>
            </div>
            <div class="text-outline-variant text-2xl">→</div>
            <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
              <div class="text-2xl mb-2">🤖</div>
              <div class="font-semibold text-primary text-sm mb-1">Claude API</div>
              <div class="text-xs text-outline">Agent stratégique</div>
            </div>
            <div class="text-outline-variant text-2xl">→</div>
            <div class="bg-surface border border-outline-variant/20 rounded-2xl p-5 text-center w-44">
              <div class="text-2xl mb-2">📋</div>
              <div class="font-semibold text-primary text-sm mb-1">Brief</div>
              <div class="text-xs text-outline">Email / Dashboard</div>
            </div>
          </div>
        </div>

        <!-- Info cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6">
            <h3 class="font-semibold text-primary mb-3">Meta Graph API</h3>
            <ul class="space-y-2 text-sm text-on-surface-variant">
              <li>✓ Gratuit avec un compte Meta Business</li>
              <li>✓ Nécessite une App Review pour les insights</li>
              <li>✓ Données: portée, impressions, engagement, sauvegardes</li>
            </ul>
          </div>
          <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6">
            <h3 class="font-semibold text-primary mb-3">Configuration du cron</h3>
            <ul class="space-y-2 text-sm text-on-surface-variant">
              <li>✓ Vercel Cron Jobs (inclus avec Vercel Pro)</li>
              <li>✓ Déclenchement chaque lundi à 8h00</li>
              <li>✓ Livraison du brief par courriel automatique</li>
            </ul>
          </div>
        </div>

        <!-- Code block -->
        <div class="bg-[#1e1a17] rounded-2xl p-6 font-mono text-sm text-[#e8ddd0] overflow-x-auto">
          <div class="text-[#a09080] mb-3">// server/api/admin/generate-brief.post.ts</div>
          <div><span class="text-[#cce9dd]">export default</span> defineEventHandler(<span class="text-[#cce9dd]">async</span> (event) =&gt; &#123;</div>
          <div class="pl-4 text-[#a09080]">// 1. Vérifier l'authentification</div>
          <div class="pl-4"><span class="text-[#cce9dd]">const</span> session = getCookie(event, <span class="text-[#E07A5F]">'admin_session'</span>)</div>
          <div class="pl-4 mb-2"><span class="text-[#cce9dd]">if</span> (session !== <span class="text-[#E07A5F]">'authenticated'</span>) <span class="text-[#cce9dd]">throw</span> createError(&#123; statusCode: <span class="text-[#C9A84C]">401</span> &#125;)</div>
          <div class="pl-4 text-[#a09080]">// 2. Récupérer les statistiques Meta</div>
          <div class="pl-4 mb-2"><span class="text-[#cce9dd]">const</span> insights = getCachedInsights() || getMockInsights()</div>
          <div class="pl-4 text-[#a09080]">// 3. Appeler Claude API</div>
          <div class="pl-4"><span class="text-[#cce9dd]">const</span> message = <span class="text-[#cce9dd]">await</span> client.messages.create(&#123;</div>
          <div class="pl-8">model: <span class="text-[#E07A5F]">'claude-sonnet-4-6'</span>,</div>
          <div class="pl-8">max_tokens: <span class="text-[#C9A84C]">1500</span>,</div>
          <div class="pl-8">system: systemPrompt,</div>
          <div class="pl-4 mb-2">&#125;)</div>
          <div class="pl-4 text-[#a09080]">// 4. Retourner le brief</div>
          <div class="pl-4"><span class="text-[#cce9dd]">return</span> &#123; brief: message.content[<span class="text-[#C9A84C]">0</span>].text, generatedAt: <span class="text-[#cce9dd]">new</span> Date() &#125;</div>
          <div>&#125;)</div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════
           TAB 4 — PROMPT SYSTÈME
           ══════════════════════════════════════════════════════ -->
      <div v-show="activeTab === 'prompt'">
        <h2 class="font-headline italic text-2xl text-primary mb-6">Prompt système de l'agent</h2>

        <textarea
          v-model="systemPromptText"
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

    </div>

    <!-- ══════════════════════════════════════════════════════
         META SETUP MODAL
         ══════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div
        v-if="showMetaSetupModal"
        class="fixed inset-0 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        @click.self="showMetaSetupModal = false"
      >
        <div class="bg-surface rounded-[2rem] p-8 max-w-md w-full editorial-shadow max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-headline italic text-xl text-primary">Configuration Meta</h3>
            <button @click="showMetaSetupModal = false" class="text-outline hover:text-primary text-xl transition duration-200">✕</button>
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
            @click="showMetaSetupModal = false"
            class="mt-6 w-full bg-primary text-on-primary py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition duration-200"
          >
            Compris
          </button>
        </div>
      </div>
    </Teleport>

  </div>
</template>
