<script setup lang="ts">
import { SYSTEM_PROMPT } from '~/utils/agentPrompt'

definePageMeta({ layout: 'admin', middleware: 'admin' })

// ─── State ───────────────────────────────────────────────────────────────────
const activeTab = ref<'dashboard' | 'brief' | 'architecture' | 'prompt'>('dashboard')
const { logout, fetchInsights, uploadInsights, scrapeInstagram, generateBrief } = useAdmin()

// Tab 1 – Insights
const insights = ref<any>(null)
const insightsLoading = ref(false)
const insightsError = ref(false)
const showMetaSetupModal = ref(false)

// Tab 1 – Instagram Scraper
const igUsername = ref('')
const scrapeLoading = ref(false)
const scrapeError = ref('')
const scrapeElapsed = ref(0)
let scrapeTimer: ReturnType<typeof setInterval> | null = null

const scrapeStep = computed(() => {
  if (scrapeElapsed.value < 3)  return '⏳ Connexion au scraper…'
  if (scrapeElapsed.value < 10) return '🔍 Lecture du profil…'
  if (scrapeElapsed.value < 30) return '📊 Analyse des publications…'
  return '✨ Traitement des données…'
})

// Tab 1 – Facebook CSV Upload
const csvFiles = ref<File[]>([])
const uploadLoading = ref(false)
const uploadError = ref('')

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
  loadBriefHistory()
  loadSavedPrompt()
  if (import.meta.client) {
    const saved = localStorage.getItem('cm_ig_username')
    if (saved) igUsername.value = saved
  }
})

// ─── Instagram Scraper ───────────────────────────────────────────────────────
async function handleScrape() {
  const username = igUsername.value.trim().replace(/^@/, '')
  if (!username) { scrapeError.value = 'Veuillez entrer un nom d\'utilisateur Instagram.'; return }
  scrapeLoading.value = true
  scrapeError.value = ''
  scrapeElapsed.value = 0
  scrapeTimer = setInterval(() => { scrapeElapsed.value++ }, 1000)
  try {
    const res = await scrapeInstagram(username) as any
    insights.value = res.insights
    if (import.meta.client) localStorage.setItem('cm_ig_username', igUsername.value)
  } catch (e: any) {
    scrapeError.value = e?.data?.message || 'Erreur lors du scraping. Réessayez.'
  } finally {
    scrapeLoading.value = false
    if (scrapeTimer) { clearInterval(scrapeTimer); scrapeTimer = null }
  }
}

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

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return
  const added = Array.from(input.files)
  const existing = csvFiles.value.map(f => f.name)
  for (const f of added) {
    if (!existing.includes(f.name)) csvFiles.value.push(f)
  }
  input.value = ''
}

function removeFile(index: number) {
  csvFiles.value.splice(index, 1)
}

async function handleUpload() {
  if (csvFiles.value.length === 0) {
    uploadError.value = 'Veuillez sélectionner au moins un fichier CSV.'
    return
  }
  uploadLoading.value = true
  uploadError.value = ''
  try {
    const form = new FormData()
    for (const file of csvFiles.value) {
      form.append('file', file, file.name)
    }
    const res = await uploadInsights(form) as any
    insights.value = res.insights
  } catch (e: any) {
    uploadError.value = e?.data?.message || 'Erreur lors du traitement des fichiers.'
  } finally {
    uploadLoading.value = false
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

        <!-- Scrape loading -->
        <div v-if="scrapeLoading" class="bg-surface rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div class="h-1.5 bg-gradient-to-r from-[#E1306C] to-[#7B5EA7] animate-pulse" />
          <div class="p-10 text-center">
            <div class="text-4xl mb-4">📸</div>
            <p class="text-on-surface font-semibold text-lg mb-2">{{ scrapeStep }}</p>
            <p class="text-outline text-sm mb-6">{{ scrapeElapsed }} seconde{{ scrapeElapsed !== 1 ? 's' : '' }}…</p>
            <div class="space-y-2 max-w-sm mx-auto">
              <div class="h-2.5 bg-surface-container-high rounded-full animate-pulse" />
              <div class="h-2.5 bg-surface-container-high rounded-full animate-pulse w-4/5 mx-auto" />
              <div class="h-2.5 bg-surface-container-high rounded-full animate-pulse w-3/5 mx-auto" />
            </div>
          </div>
        </div>

        <!-- FB CSV loading -->
        <div v-else-if="uploadLoading" class="bg-surface rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div class="h-1.5 bg-gradient-to-r from-[#1877F2] to-primary animate-pulse" />
          <div class="p-8 text-center">
            <div class="text-3xl mb-4">📊</div>
            <p class="text-on-surface font-semibold mb-4">Analyse des fichiers Facebook CSV…</p>
            <div class="space-y-2 max-w-sm mx-auto">
              <div class="h-3 bg-surface-container-high rounded animate-pulse" />
              <div class="h-3 bg-surface-container-high rounded animate-pulse w-4/5 mx-auto" />
              <div class="h-3 bg-surface-container-high rounded animate-pulse w-3/5 mx-auto" />
            </div>
          </div>
        </div>

        <!-- State A: Input zone -->
        <div v-else-if="!insights" class="space-y-6">

          <!-- Instagram scraper -->
          <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6">
            <div class="flex items-center gap-2 mb-4">
              <span class="w-2.5 h-2.5 rounded-full bg-[#E1306C] inline-block"></span>
              <h2 class="font-semibold text-primary text-sm">Analyser un profil Instagram</h2>
            </div>
            <div class="flex gap-3">
              <div class="flex-1 flex items-center bg-background border border-outline-variant/30 rounded-xl px-4 focus-within:border-[#E1306C] transition">
                <span class="text-outline text-sm font-medium mr-1">@</span>
                <input
                  v-model="igUsername"
                  type="text"
                  placeholder="chantalmasse"
                  class="flex-1 bg-transparent py-3 text-sm text-on-surface outline-none placeholder:text-outline/50"
                  @keyup.enter="handleScrape"
                />
              </div>
              <button
                @click="handleScrape"
                class="bg-[#E1306C] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition whitespace-nowrap"
              >
                Analyser →
              </button>
            </div>
            <div v-if="scrapeError" class="mt-3 text-[#E07A5F] text-sm bg-[#E07A5F]/10 rounded-xl px-4 py-2">
              {{ scrapeError }}
            </div>
          </div>

          <!-- Divider -->
          <div class="flex items-center gap-3 text-outline text-xs">
            <div class="flex-1 h-px bg-outline-variant/20"></div>
            <span class="font-medium uppercase tracking-wider">Facebook (optionnel)</span>
            <div class="flex-1 h-px bg-outline-variant/20"></div>
          </div>

          <!-- Facebook CSV zone -->
          <div class="space-y-4">
            <p class="text-sm text-outline text-center">
              📁 Importez vos CSV Facebook pour enrichir l'analyse
              <span class="text-outline/60">(vues, interactions, clics, visites, abonnés)</span>
            </p>

            <div class="bg-surface rounded-2xl border-2 border-dashed border-[#1877F2]/30 p-5">
              <div v-if="csvFiles.length > 0" class="mb-3 space-y-1.5">
                <div
                  v-for="(file, i) in csvFiles"
                  :key="file.name"
                  class="flex items-center justify-between bg-background rounded-xl px-3 py-2 text-sm border border-outline-variant/20"
                >
                  <span class="text-[#3D9970] font-semibold truncate">✓ {{ file.name }}</span>
                  <button @click="removeFile(i)" class="text-outline hover:text-[#E07A5F] ml-2 shrink-0 text-xs">✕</button>
                </div>
              </div>
              <label class="block cursor-pointer">
                <input type="file" accept=".csv" multiple class="sr-only" @change="onFilesSelected" />
                <div class="bg-background rounded-xl p-3 text-sm text-center transition hover:bg-surface-container-low border border-outline-variant/20">
                  <span class="text-outline">{{ csvFiles.length > 0 ? '+ Ajouter des fichiers…' : 'Choisir des fichiers CSV Facebook…' }}</span>
                </div>
              </label>
            </div>

            <div v-if="uploadError" class="bg-[#E07A5F]/10 border border-[#E07A5F]/30 rounded-xl p-3 text-[#E07A5F] text-sm">
              {{ uploadError }}
            </div>

            <div v-if="csvFiles.length > 0" class="flex justify-center">
              <button
                @click="handleUpload"
                class="bg-[#1877F2] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition"
              >
                Importer les données Facebook →
              </button>
            </div>

            <!-- Export instructions -->
            <div class="bg-primary-fixed rounded-2xl p-4 text-xs space-y-3">
              <p class="font-semibold text-primary text-sm">📥 Comment exporter depuis Facebook Business Suite</p>
              <ol class="list-decimal list-inside space-y-0.5 text-primary/80">
                <li>Business Suite → votre Page → Statistiques → Exporter les données</li>
                <li>Exportez : <span class="font-medium">Vues · Viewers · Interactions · Clics · Visites · Abonnés</span></li>
                <li>Importez les 6 fichiers ici</li>
              </ol>
            </div>
          </div>
        </div>

        <!-- State B: Data loaded -->
        <div v-else class="space-y-8">

          <!-- ── Scrape view ── -->
          <template v-if="insights.source === 'scrape'">

            <!-- Profile header -->
            <div class="bg-surface rounded-2xl border border-outline-variant/20 p-5">
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <div class="flex items-center gap-4">
                  <div class="w-14 h-14 rounded-2xl bg-[#E1306C]/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                    <img
                      v-if="insights.profile?.profilePic"
                      :src="insights.profile.profilePic"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover"
                      @error="($event.target as HTMLImageElement).style.display = 'none'"
                    />
                    <span v-else>📸</span>
                  </div>
                  <div>
                    <div class="font-semibold text-on-surface">{{ insights.profile?.fullName || '@' + insights.profile?.username }}</div>
                    <div class="text-sm text-outline">@{{ insights.profile?.username }}</div>
                    <div class="text-xs text-outline mt-0.5">
                      {{ insights.profile?.followers?.toLocaleString('fr-CA') }} abonnés
                      · {{ insights.profile?.postsCount }} publications
                    </div>
                  </div>
                </div>
                <button
                  @click="handleScrape"
                  :disabled="scrapeLoading"
                  class="flex items-center gap-2 text-sm text-primary/70 hover:text-primary font-semibold transition disabled:opacity-40"
                >
                  🔄 Actualiser
                </button>
              </div>
            </div>

            <!-- Analytics KPIs -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-surface rounded-2xl p-4 border border-outline-variant/20 editorial-shadow">
                <div class="text-lg mb-1">📅</div>
                <div class="text-xs text-outline mb-0.5">Meilleur jour</div>
                <div class="text-base font-semibold text-[#E07A5F]">{{ insights.analytics?.bestDay }}</div>
              </div>
              <div class="bg-surface rounded-2xl p-4 border border-outline-variant/20 editorial-shadow">
                <div class="text-lg mb-1">🕐</div>
                <div class="text-xs text-outline mb-0.5">Meilleure heure</div>
                <div class="text-base font-semibold text-[#7B5EA7]">{{ insights.analytics?.bestHour }}</div>
              </div>
              <div class="bg-surface rounded-2xl p-4 border border-outline-variant/20 editorial-shadow">
                <div class="text-lg mb-1">🎬</div>
                <div class="text-xs text-outline mb-0.5">Meilleur format</div>
                <div class="text-base font-semibold text-[#3D9970]">{{ insights.analytics?.bestFormat }}</div>
              </div>
              <div class="bg-surface rounded-2xl p-4 border border-outline-variant/20 editorial-shadow">
                <div class="text-lg mb-1">💫</div>
                <div class="text-xs text-outline mb-0.5">Engagement moy.</div>
                <div class="text-base font-semibold text-[#C9A84C]">{{ insights.analytics?.avgEngagement?.toLocaleString('fr-CA') }} <span class="text-xs font-normal text-outline">/ pub</span></div>
              </div>
            </div>

            <!-- Post grid -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <h2 class="font-headline italic text-xl text-primary">
                  {{ insights.posts?.length }} dernières publications
                </h2>
                <span class="text-xs text-outline bg-surface-container-high px-3 py-1 rounded-full">
                  {{ insights.week }}
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  v-for="post in insights.posts"
                  :key="post.id"
                  :href="post.url"
                  target="_blank"
                  rel="noopener"
                  class="flex gap-4 bg-surface border border-[#f0ebe4] rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer no-underline group"
                >
                  <!-- Thumbnail -->
                  <div class="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-container-high flex items-center justify-center">
                    <img
                      v-if="post.thumbnailUrl"
                      :src="post.thumbnailUrl"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover"
                      @error="($event.target as HTMLImageElement).style.display = 'none'"
                    />
                    <span v-else class="text-2xl" :style="{ color: post.pillarMeta?.color }">
                      {{ post.pillarMeta?.emoji }}
                    </span>
                    <!-- Type overlay -->
                    <div v-if="post.isReel" class="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span class="text-white text-xs font-bold">▶</span>
                    </div>
                    <div v-else-if="post.isCarousel" class="absolute top-1 right-1 bg-black/40 rounded text-white text-xs px-1">⊞</div>
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span class="text-xs font-semibold" :style="{ color: post.pillarMeta?.color }">{{ post.type }}</span>
                        <span class="text-xs text-outline mx-1">·</span>
                        <span class="text-xs text-outline">{{ post.day }} {{ post.date }}</span>
                      </div>
                      <span class="text-outline/40 group-hover:text-outline transition text-xs shrink-0">↗</span>
                    </div>

                    <!-- Pillar badge -->
                    <span
                      class="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2"
                      :style="{ backgroundColor: post.pillarMeta?.color + '1A', color: post.pillarMeta?.color }"
                    >
                      {{ post.pillarMeta?.emoji }} {{ post.pillarMeta?.label }}
                    </span>

                    <!-- Stats -->
                    <div class="flex items-center gap-3 text-xs text-outline mb-1.5">
                      <span v-if="post.isReel">👁 {{ post.views?.toLocaleString('fr-CA') }} vues</span>
                      <span v-else>❤️ {{ post.likes?.toLocaleString('fr-CA') }}</span>
                      <span>💬 {{ post.comments }}</span>
                      <span class="text-[#3D9970] font-medium">{{ post.engagementRate }}</span>
                    </div>

                    <!-- Caption -->
                    <p class="text-xs text-outline/70 font-body italic leading-snug truncate">
                      {{ post.caption?.slice(0, 90) }}…
                    </p>
                  </div>
                </a>
              </div>
            </div>

            <!-- Facebook enrichment -->
            <div>
              <div class="flex items-center gap-3 text-outline text-xs mb-4">
                <div class="flex-1 h-px bg-outline-variant/20"></div>
                <span class="font-medium uppercase tracking-wider">Facebook (optionnel)</span>
                <div class="flex-1 h-px bg-outline-variant/20"></div>
              </div>

              <!-- Show FB KPIs if present -->
              <div v-if="insights.facebook" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div class="bg-surface rounded-xl p-3 border-l-4 border-[#1877F2] border border-outline-variant/20 text-center">
                  <div class="text-xs text-outline mb-0.5">Vues</div>
                  <div class="font-semibold text-sm">{{ (insights.facebook.views || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3 border-l-4 border-[#1877F2] border border-outline-variant/20 text-center">
                  <div class="text-xs text-outline mb-0.5">Interactions</div>
                  <div class="font-semibold text-sm">{{ ((insights.facebook.likes || 0) + (insights.facebook.comments || 0) + (insights.facebook.shares || 0)).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3 border-l-4 border-[#1877F2] border border-outline-variant/20 text-center">
                  <div class="text-xs text-outline mb-0.5">Clics</div>
                  <div class="font-semibold text-sm">{{ (insights.facebook.linkClicks || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-xl p-3 border-l-4 border-[#1877F2] border border-outline-variant/20 text-center">
                  <div class="text-xs text-outline mb-0.5">Abonnés</div>
                  <div class="font-semibold text-sm">{{ (insights.facebook.newFollowers || 0).toLocaleString('fr-CA') }}</div>
                </div>
              </div>

              <div class="bg-surface rounded-2xl border-2 border-dashed border-[#1877F2]/30 p-5">
                <p class="text-sm text-outline text-center mb-3">
                  {{ insights.facebook ? '🔄 Mettre à jour les données Facebook' : '📁 Ajouter des données Facebook pour enrichir le brief' }}
                </p>
                <div v-if="csvFiles.length > 0" class="mb-3 space-y-1.5">
                  <div
                    v-for="(file, i) in csvFiles"
                    :key="file.name"
                    class="flex items-center justify-between bg-background rounded-xl px-3 py-2 text-sm border border-outline-variant/20"
                  >
                    <span class="text-[#3D9970] font-semibold truncate">✓ {{ file.name }}</span>
                    <button @click="removeFile(i)" class="text-outline hover:text-[#E07A5F] ml-2 shrink-0 text-xs">✕</button>
                  </div>
                </div>
                <label class="block cursor-pointer">
                  <input type="file" accept=".csv" multiple class="sr-only" @change="onFilesSelected" />
                  <div class="bg-background rounded-xl p-3 text-sm text-center transition hover:bg-surface-container-low border border-outline-variant/20">
                    <span class="text-outline">{{ csvFiles.length > 0 ? '+ Ajouter des fichiers…' : 'Choisir des fichiers CSV Facebook…' }}</span>
                  </div>
                </label>
                <div v-if="uploadError" class="mt-2 text-[#E07A5F] text-sm bg-[#E07A5F]/10 rounded-xl px-4 py-2">{{ uploadError }}</div>
                <div v-if="csvFiles.length > 0" class="mt-3 flex justify-center">
                  <button @click="handleUpload" class="bg-[#1877F2] text-white px-6 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition">
                    Importer →
                  </button>
                </div>
              </div>
            </div>

            <!-- Reset -->
            <div class="flex justify-end">
              <button
                @click="insights = null; csvFiles = []; scrapeError = ''; uploadError = ''"
                class="text-xs text-primary/50 hover:text-primary font-semibold transition"
              >
                ↑ Réanalyser
              </button>
            </div>
          </template>

          <!-- ── CSV view (aggregate metrics) ── -->
          <template v-else>
            <div class="flex items-center justify-between">
              <div class="text-xs text-outline">Données CSV · {{ insights.week }}</div>
              <button
                @click="insights = null; csvFiles = []; uploadError = ''"
                class="text-xs text-primary/60 hover:text-primary font-semibold transition"
              >
                ↑ Re-importer
              </button>
            </div>

            <!-- KPI — Instagram -->
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="w-2.5 h-2.5 rounded-full bg-[#E1306C] inline-block"></span>
                <span class="font-semibold text-sm text-primary">Instagram</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#E1306C] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">👁</div><div class="text-xs text-outline mb-0.5">Vues</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.instagram?.views || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#E1306C] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">📊</div><div class="text-xs text-outline mb-0.5">Portée</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.instagram?.reach || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#E1306C] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">💬</div><div class="text-xs text-outline mb-0.5">Interactions</div>
                  <div class="text-lg font-semibold text-on-surface">{{ ((insights.instagram?.likes || 0) + (insights.instagram?.comments || 0) + (insights.instagram?.saves || 0) + (insights.instagram?.shares || 0)).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#E1306C] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">🔗</div><div class="text-xs text-outline mb-0.5">Clics</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.instagram?.linkClicks || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#E1306C] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">🏠</div><div class="text-xs text-outline mb-0.5">Visites</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.instagram?.profileVisits || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#E1306C] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">👥</div><div class="text-xs text-outline mb-0.5">Nouveaux abonnés</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.instagram?.newFollowers || 0).toLocaleString('fr-CA') }}</div>
                </div>
              </div>
            </div>

            <!-- KPI — Facebook -->
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="w-2.5 h-2.5 rounded-full bg-[#1877F2] inline-block"></span>
                <span class="font-semibold text-sm text-primary">Facebook</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#1877F2] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">👁</div><div class="text-xs text-outline mb-0.5">Vues</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.facebook?.views || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#1877F2] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">👁</div><div class="text-xs text-outline mb-0.5">Viewers uniques</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.facebook?.uniqueViewers || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#1877F2] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">💬</div><div class="text-xs text-outline mb-0.5">Interactions</div>
                  <div class="text-lg font-semibold text-on-surface">{{ ((insights.facebook?.likes || 0) + (insights.facebook?.comments || 0) + (insights.facebook?.shares || 0)).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#1877F2] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">🔗</div><div class="text-xs text-outline mb-0.5">Clics</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.facebook?.linkClicks || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#1877F2] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">🏠</div><div class="text-xs text-outline mb-0.5">Visites</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.facebook?.pageVisits || 0).toLocaleString('fr-CA') }}</div>
                </div>
                <div class="bg-surface rounded-2xl p-4 border-l-4 border-[#1877F2] border border-outline-variant/20 editorial-shadow">
                  <div class="text-lg mb-1">👥</div><div class="text-xs text-outline mb-0.5">Nouveaux abonnés</div>
                  <div class="text-lg font-semibold text-on-surface">{{ (insights.facebook?.newFollowers || 0).toLocaleString('fr-CA') }}</div>
                </div>
              </div>
            </div>

            <!-- Content Pillars -->
            <div>
              <h2 class="font-headline italic text-xl text-primary mb-4">Piliers de contenu</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  v-for="pillar in PILLARS"
                  :key="pillar.name"
                  class="rounded-2xl p-5 border"
                  :style="{ backgroundColor: pillar.color + '1A', borderColor: pillar.color + '4D' }"
                >
                  <div class="text-2xl mb-2">{{ pillar.icon }}</div>
                  <div class="font-semibold text-on-surface mb-0.5">{{ pillar.name }}</div>
                  <div class="text-xs font-semibold mb-2 inline-block px-2 py-0.5 rounded-full" :style="{ backgroundColor: pillar.color + '33', color: pillar.color }">{{ pillar.format }}</div>
                  <p class="text-sm text-on-surface-variant">{{ pillar.tip }}</p>
                </div>
              </div>
            </div>
          </template>

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
