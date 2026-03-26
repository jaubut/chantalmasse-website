<script setup lang="ts">
const { scrapeInstagram } = useAdmin()

// ─── State ───────────────────────────────────────────────────────────────────
const insights = ref<any>(null)
const lastScrapedAt = ref<Date | null>(null)

const igUsername = ref('')
const fbUsername = ref('')
const scrapeLoading = ref(false)
const scrapeError = ref('')
const scrapeElapsed = ref(0)
let scrapeTimer: ReturnType<typeof setInterval> | null = null

// ─── Computed ────────────────────────────────────────────────────────────────
const scrapeStep = computed(() => {
  if (scrapeElapsed.value < 3)  return '⏳ Connexion aux scrapers…'
  if (scrapeElapsed.value < 10) return '🔍 Lecture des profils Instagram & Facebook…'
  if (scrapeElapsed.value < 30) return '📊 Analyse des publications…'
  return '✨ Traitement des données…'
})

const lastScrapedLabel = computed(() => {
  if (!lastScrapedAt.value) return null
  const diffMs = Date.now() - lastScrapedAt.value.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'à l\'instant'
  if (diffMins < 60) return `il y a ${diffMins} min`
  if (diffHours < 24) return `il y a ${diffHours}h`
  if (diffDays === 1) return 'hier'
  return `il y a ${diffDays} jours`
})

// ─── Persistence ─────────────────────────────────────────────────────────────
function saveToStorage(data: any) {
  if (!import.meta.client) return
  localStorage.setItem('cm_insights', JSON.stringify({ data, savedAt: Date.now() }))
}

function loadFromStorage() {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem('cm_insights')
    if (!raw) return
    const { data, savedAt } = JSON.parse(raw)
    insights.value = data
    lastScrapedAt.value = new Date(savedAt)
  } catch { /* ignore */ }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  if (!import.meta.client) return
  const savedIg = localStorage.getItem('cm_ig_username')
  if (savedIg) igUsername.value = savedIg
  const savedFb = localStorage.getItem('cm_fb_username')
  if (savedFb) fbUsername.value = savedFb
  loadFromStorage()
})

// ─── Instagram Scraper ───────────────────────────────────────────────────────
async function handleScrape() {
  const username = igUsername.value.trim().replace(/^@/, '')
  const fbUser  = fbUsername.value.trim().replace(/^@/, '')
  if (!username) { scrapeError.value = 'Veuillez entrer un nom d\'utilisateur Instagram.'; return }
  scrapeLoading.value = true
  scrapeError.value = ''
  scrapeElapsed.value = 0
  scrapeTimer = setInterval(() => { scrapeElapsed.value++ }, 1000)
  try {
    const res = await scrapeInstagram(username, fbUser || username) as any
    insights.value = res.insights
    lastScrapedAt.value = new Date()
    if (import.meta.client) {
      localStorage.setItem('cm_ig_username', igUsername.value)
      localStorage.setItem('cm_fb_username', fbUsername.value)
    }
    saveToStorage(res.insights)
  } catch (e: any) {
    scrapeError.value = e?.data?.message || 'Erreur lors du scraping. Réessayez.'
  } finally {
    scrapeLoading.value = false
    if (scrapeTimer) { clearInterval(scrapeTimer); scrapeTimer = null }
  }
}


// ─── Reset ───────────────────────────────────────────────────────────────────
function resetInsights() {
  insights.value = null
  scrapeError.value = ''
  lastScrapedAt.value = null
  if (import.meta.client) localStorage.removeItem('cm_insights')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PILLARS = [
  { icon: '⚡', name: 'Mythe vs Réalité', format: 'Reel', tip: 'Déconstruire les idées reçues sur la thérapie. Fort potentiel viral.', color: '#7B5EA7' },
  { icon: '💬', name: 'Q&R Instagram', format: 'Story / Carrousel', tip: 'Segment "Demandez à la thérapeute". Booste l\'engagement direct.', color: '#E07A5F' },
  { icon: '📅', name: 'Micro-Défi', format: 'Carrousel', tip: 'Exercices concrets pour les couples. Très partageable.', color: '#3D9970' },
  { icon: '✨', name: 'Réflexions', format: 'Publication statique', tip: 'Citations et insights de couples anonymes. Renforce la confiance.', color: '#C9A84C' },
]

function proxyImg(url: string): string {
  if (!url) return ''
  return `/api/img-proxy?url=${encodeURIComponent(url)}`
}

</script>

<template>
  <div>

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

    <!-- State A: Input zone -->
    <div v-else-if="!insights" class="space-y-6">

      <!-- Scraper inputs -->
      <div class="bg-surface rounded-2xl border border-outline-variant/20 p-6 space-y-4">
        <h2 class="font-semibold text-primary text-sm">Analyser les profils</h2>

        <!-- Instagram -->
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2 h-2 rounded-full bg-[#E1306C] inline-block"></span>
            <span class="text-xs text-outline font-medium">Instagram</span>
          </div>
          <div class="flex items-center bg-background border border-outline-variant/30 rounded-xl px-4 focus-within:border-[#E1306C] transition">
            <span class="text-outline text-sm font-medium mr-1">@</span>
            <input
              v-model="igUsername"
              type="text"
              placeholder="chantalmasse"
              class="flex-1 bg-transparent py-3 text-sm text-on-surface outline-none placeholder:text-outline/50"
              @keyup.enter="handleScrape"
            />
          </div>
        </div>

        <!-- Facebook -->
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2 h-2 rounded-full bg-[#1877F2] inline-block"></span>
            <span class="text-xs text-outline font-medium">Facebook <span class="text-outline/50">(laisse vide si même identifiant)</span></span>
          </div>
          <div class="flex items-center bg-background border border-outline-variant/30 rounded-xl px-4 focus-within:border-[#1877F2] transition">
            <span class="text-outline text-sm font-medium mr-1">@</span>
            <input
              v-model="fbUsername"
              type="text"
              placeholder="chantalmasse.therapeute"
              class="flex-1 bg-transparent py-3 text-sm text-on-surface outline-none placeholder:text-outline/50"
              @keyup.enter="handleScrape"
            />
          </div>
        </div>

        <button
          @click="handleScrape"
          class="w-full bg-[#E1306C] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition"
        >
          Analyser →
        </button>

        <div v-if="scrapeError" class="text-[#E07A5F] text-sm bg-[#E07A5F]/10 rounded-xl px-4 py-2">
          {{ scrapeError }}
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
                  :src="proxyImg(insights.profile.profilePic)"
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
            <div class="flex flex-col items-end gap-1">
              <button
                @click="handleScrape"
                :disabled="scrapeLoading"
                class="flex items-center gap-2 text-sm text-primary/70 hover:text-primary font-semibold transition disabled:opacity-40"
              >
                🔄 Actualiser
              </button>
              <span v-if="lastScrapedLabel" class="text-xs text-outline/60">{{ lastScrapedLabel }}</span>
            </div>
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
                  :src="proxyImg(post.thumbnailUrl)"
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <span v-else class="text-2xl" :style="{ color: post.pillarMeta?.color }">
                  {{ post.pillarMeta?.emoji }}
                </span>
                <div v-if="post.isReel" class="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <span class="text-white text-xs font-bold">▶</span>
                </div>
                <div v-else-if="post.isCarousel" class="absolute top-1 right-1 bg-black/40 rounded text-white text-xs px-1">⊞</div>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2 mb-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                      class="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                      :style="{ backgroundColor: post.platform === 'Facebook' ? '#1877F2' : '#E1306C' }"
                    >{{ post.platform === 'Facebook' ? 'FB' : 'IG' }}</span>
                    <span class="text-xs font-semibold" :style="{ color: post.pillarMeta?.color }">{{ post.type }}</span>
                    <span class="text-xs text-outline mx-1">·</span>
                    <span class="text-xs text-outline">{{ post.day }} {{ post.date }}</span>
                  </div>
                  <span class="text-outline/40 group-hover:text-outline transition text-xs shrink-0">↗</span>
                </div>

                <span
                  class="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2"
                  :style="{ backgroundColor: post.pillarMeta?.color + '1A', color: post.pillarMeta?.color }"
                >
                  {{ post.pillarMeta?.emoji }} {{ post.pillarMeta?.label }}
                </span>

                <div class="flex items-center gap-3 text-xs text-outline mb-1.5">
                  <span v-if="post.isReel">👁 {{ post.views?.toLocaleString('fr-CA') }} vues</span>
                  <span v-else>❤️ {{ post.likes?.toLocaleString('fr-CA') }}</span>
                  <span>💬 {{ post.comments }}</span>
                  <span class="text-[#3D9970] font-medium">{{ post.engagementRate }}</span>
                </div>

                <p class="text-xs text-outline/70 font-body italic leading-snug truncate">
                  {{ post.caption?.slice(0, 90) }}…
                </p>
              </div>
            </a>
          </div>
        </div>

        <!-- Reset -->
        <div class="flex justify-end">
          <button
            @click="resetInsights"
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
            @click="resetInsights"
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
</template>
