<script setup lang="ts">
import { SYSTEM_PROMPT } from '~/utils/agentPrompt'

const props = defineProps<{ systemPrompt: string }>()

const { generateBrief } = useAdmin()

// ─── State ───────────────────────────────────────────────────────────────────
const briefState = ref<'empty' | 'loading' | 'generated'>('empty')
const currentBrief = ref<{ text: string; generatedAt: string } | null>(null)
const parsedBrief = ref<{ posts: any[]; strategicTip: string } | null>(null)
const briefHistory = ref<{ date: string; summary: string; fullText: string }[]>([])
const briefEmailSending = ref(false)
const briefEmailSent = ref(false)
const briefCopied = ref(false)

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
  if (!import.meta.client) return
  try {
    const stored = localStorage.getItem('cm_briefs')
    if (stored) briefHistory.value = JSON.parse(stored)
  } catch { /* ignore */ }
})

// ─── Brief ───────────────────────────────────────────────────────────────────
async function handleGenerateBrief() {
  briefState.value = 'loading'
  briefEmailSent.value = false
  briefCopied.value = false
  try {
    const res = await generateBrief({
      action: 'generate',
      customPrompt: props.systemPrompt !== SYSTEM_PROMPT ? props.systemPrompt : undefined,
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
    const res = await generateBrief({ action: 'email' }) as any
    if (res.emailError) {
      alert(`Erreur d'envoi : ${res.emailError}`)
    } else {
      briefEmailSent.value = true
    }
  } catch (e: any) {
    alert(`Erreur : ${e?.data?.message || e?.message || 'Inconnue'}`)
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

function viewHistoricBrief(entry: { fullText: string; date: string }) {
  currentBrief.value = { text: entry.fullText, generatedAt: entry.date }
  parsedBrief.value = parseBrief(entry.fullText)
  briefState.value = 'generated'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  if (p.includes('q&r') || p.includes('question')) return '#E07A5F'
  if (p.includes('défi') || p.includes('micro')) return '#3D9970'
  if (p.includes('réflexion') || p.includes('reflexion')) return '#C9A84C'
  return '#173028'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div>

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

        <div v-if="parsedBrief" class="space-y-4">
          <div
            v-for="(post, i) in parsedBrief.posts"
            :key="i"
            class="bg-background rounded-2xl p-5 border-l-4"
            :style="{ borderLeftColor: pillarColor(post.pillar) }"
          >
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
            <p class="font-headline italic text-primary text-base mb-2 leading-snug">
              "{{ post.hook }}"
            </p>
            <p class="text-sm text-outline leading-relaxed">
              <span class="font-semibold text-on-surface-variant">Pourquoi:</span> {{ post.why }}
            </p>
          </div>

          <div v-if="parsedBrief.strategicTip" class="bg-primary-fixed rounded-2xl p-5">
            <p class="font-semibold text-primary mb-1">💡 Conseil stratégique de la semaine</p>
            <p class="text-primary/80 text-sm leading-relaxed">{{ parsedBrief.strategicTip }}</p>
          </div>
        </div>

        <div v-else class="whitespace-pre-wrap text-sm text-on-surface leading-relaxed">
          {{ currentBrief.text }}
        </div>
      </div>

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
</template>
