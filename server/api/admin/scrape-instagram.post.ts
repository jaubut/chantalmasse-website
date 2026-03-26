import { setCachedInsights } from '~/utils/metaApi'

export default defineEventHandler(async (event) => {
  const session = getCookie(event, 'admin_session')
  if (session !== 'authenticated') {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const { username, fbUsername } = await readBody(event)
  if (!username) {
    throw createError({ statusCode: 400, message: 'Username requis' })
  }
  const fbUser = (fbUsername || username) as string

  const config = useRuntimeConfig()
  if (!config.apifyApiToken) {
    throw createError({
      statusCode: 503,
      message: 'Configurez votre token Apify dans le fichier .env (APIFY_API_TOKEN) pour activer l\'analyse automatique.',
    })
  }

  const token = config.apifyApiToken as string

  // ── Run both scrapers in parallel ─────────────────────────────────────────
  const [igRunRes, fbRunRes] = await Promise.all([
    startApifyRun(token, 'apify~instagram-profile-scraper', {
      usernames: [username],
      resultsLimit: 12,
      scrapeType: 'posts',
    }),
    startApifyRun(token, 'apify~facebook-posts-scraper', {
      startUrls: [{ url: `https://www.facebook.com/${fbUser}` }],
      maxPosts: 12,
    }).catch(() => null), // Facebook is best-effort
  ])

  const igRunId = igRunRes?.data?.id
  if (!igRunId) {
    throw createError({ statusCode: 502, message: 'Impossible de démarrer le scraper Instagram' })
  }

  // ── Poll both to completion ───────────────────────────────────────────────
  const [igStatus, fbStatus] = await Promise.all([
    pollRun(token, 'apify~instagram-profile-scraper', igRunId, 15),
    fbRunRes?.data?.id
      ? pollRun(token, 'apify~facebook-posts-scraper', fbRunRes.data.id, 15).catch(() => 'FAILED')
      : Promise.resolve('SKIPPED'),
  ])

  if (igStatus !== 'SUCCEEDED') {
    throw createError({
      statusCode: 504,
      message: 'L\'analyse Instagram a pris trop de temps. Réessayez dans quelques minutes.',
    })
  }

  // ── Fetch results ─────────────────────────────────────────────────────────
  const [igItems, fbItems] = await Promise.all([
    fetchDataset(token, igRunRes.data.defaultDatasetId),
    fbRunRes?.data?.defaultDatasetId && fbStatus === 'SUCCEEDED'
      ? fetchDataset(token, fbRunRes.data.defaultDatasetId).catch(() => [])
      : Promise.resolve([]),
  ])

  // ── Parse Instagram ───────────────────────────────────────────────────────
  const igProfile = igItems.find((i: any) => i.followersCount !== undefined)
  if (!igProfile) {
    throw createError({ statusCode: 404, message: `Le compte @${username} est introuvable ou est privé.` })
  }

  const igPosts: any[] = Array.isArray(igProfile.latestPosts) ? igProfile.latestPosts : []
  if (igPosts.length === 0) {
    throw createError({
      statusCode: 422,
      message: `Profil @${username} trouvé mais aucune publication récupérée. Réessayez dans quelques minutes.`,
    })
  }

  // ── Parse Facebook ────────────────────────────────────────────────────────
  // facebook-posts-scraper returns posts directly as dataset items
  const fbPosts: any[] = Array.isArray(fbItems) ? fbItems : []
  const fbPage = fbPosts[0] ?? null  // used only for page-level meta (pageName, likes)

  // ── Build insights ────────────────────────────────────────────────────────
  const scrapeInsights = buildInsightsFromScrape(igProfile, igPosts, fbPage, fbPosts)
  setCachedInsights(scrapeInsights as any)

  return { success: true, insights: scrapeInsights }
})

// ── Apify helpers ─────────────────────────────────────────────────────────────

async function startApifyRun(token: string, actor: string, input: object) {
  return $fetch<any>(`https://api.apify.com/v2/acts/${actor}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(input),
  })
}

async function pollRun(token: string, actor: string, runId: string, maxAttempts: number): Promise<string> {
  let attempts = 0
  let status = 'RUNNING'
  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await $fetch<any>(
      `https://api.apify.com/v2/acts/${actor}/runs/${runId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    status = res.data?.status ?? 'FAILED'
    attempts++
  }
  return status
}

async function fetchDataset(token: string, datasetId: string): Promise<any[]> {
  const res = await $fetch<any>(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  return Array.isArray(res) ? res : []
}

// ── Builders ──────────────────────────────────────────────────────────────────

function buildInsightsFromScrape(igProfile: any, igRawPosts: any[], _fbPage: any, fbRawPosts: any[]) {
  const days   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const months = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']

  const pillarMeta: Record<string, { label: string; emoji: string; color: string }> = {
    myth:       { label: 'Mythe vs Réalité', emoji: '⚡', color: '#7B5EA7' },
    challenge:  { label: 'Micro-Défi',       emoji: '📅', color: '#3D9970' },
    qa:         { label: 'Q&R',              emoji: '💬', color: '#E07A5F' },
    reflection: { label: 'Réflexion',        emoji: '✨', color: '#C9A84C' },
    general:    { label: 'Général',          emoji: '📝', color: '#727975' },
  }

  function detectPillar(caption: string) {
    const cap = (caption || '').toLowerCase()
    if (/mythe|vrai|faux|réalité/.test(cap))                          return 'myth'
    if (/défi|exercice|essayez|cette semaine/.test(cap))              return 'challenge'
    if (/question|répondez|dites-moi|vous \?/.test(cap))              return 'qa'
    if (/amour|réflexion|conscient|sagesse|connexion/.test(cap))      return 'reflection'
    return 'general'
  }

  function parseIgPost(p: any) {
    const date    = new Date(p.timestamp)
    const isReel  = p.isVideo || p.type === 'Video'
    const typeMap: Record<string, string> = { Video: 'Reel', Image: 'Publication', Sidecar: 'Carrousel' }
    const likes    = p.likesCount    || 0
    const comments = p.commentsCount || 0
    const views    = p.videoViewCount || 0
    const engagement = isReel ? views + comments : likes + comments
    const reach      = isReel ? views : likes + comments
    const pillar     = detectPillar(p.caption)
    return {
      id: p.id || p.shortCode, shortCode: p.shortCode, url: p.url,
      thumbnailUrl: p.displayUrl, type: typeMap[p.type] || 'Publication',
      platform: 'Instagram', pillar, pillarMeta: pillarMeta[pillar],
      likes, comments, views, engagement, saves: 0, reach,
      engagementRate: reach > 0 ? ((engagement / reach) * 100).toFixed(1) + '%' : '0%',
      day: days[date.getDay()] ?? '', hour: date.getHours(),
      date: `${date.getDate()} ${months[date.getMonth()]}`,
      isoDate: p.timestamp, caption: (p.caption || '').slice(0, 200),
      hashtags: p.hashtags || [], isReel, isCarousel: p.type === 'Sidecar',
    }
  }

  function parseFbPost(p: any) {
    // apify/facebook-posts-scraper schema:
    // postId, url, time (ISO), text, likes, shares (int), topReactionsCount
    // media[].thumbnail, media[].large_share_image.uri
    // user.name, user.profilePic
    const raw  = p.time || ''
    const date = raw ? new Date(raw) : new Date()
    const likes    = p.likes ?? 0
    const comments = p.comments ?? 0  // not always present
    const shares   = typeof p.shares === 'number' ? p.shares : 0
    const engagement = likes + comments + shares
    const pillar     = detectPillar(p.text || '')
    const thumbnailUrl = p.media?.[0]?.thumbnail
      || p.media?.[0]?.large_share_image?.uri
      || ''
    return {
      id: p.postId || p.url || String(Math.random()),
      shortCode: null, url: p.url || '',
      thumbnailUrl,
      type: 'Publication',
      platform: 'Facebook', pillar, pillarMeta: pillarMeta[pillar],
      likes, comments, shares, views: 0, engagement, saves: 0, reach: engagement,
      engagementRate: '—',
      day: days[date.getDay()] ?? '', hour: date.getHours(),
      date: `${date.getDate()} ${months[date.getMonth()]}`,
      isoDate: raw || new Date().toISOString(),
      caption: (p.text || '').slice(0, 200),
      hashtags: [], isReel: false, isCarousel: false,
      // page info embedded per post — used for profile header
      _pageName: p.user?.name || p.pageName || '',
      _pageProfilePic: p.user?.profilePic || '',
    }
  }

  const igPosts = igRawPosts.map(parseIgPost)
  const fbPosts = fbRawPosts.map(parseFbPost)
  const fbPageName = fbPosts[0]?._pageName || ''
  const allPosts = [...igPosts, ...fbPosts.map(({ _pageName, _pageProfilePic, ...p }) => p)].sort(
    (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime()
  )

  // Analytics across all posts
  const dayEng:  Record<string, number[]> = {}
  const fmtEng:  Record<string, number[]> = {}
  const hourEng: Record<number, number[]> = {}
  for (const p of allPosts) {
    ;(dayEng[p.day]   ??= []).push(p.engagement)
    ;(fmtEng[p.type]  ??= []).push(p.engagement)
    ;(hourEng[p.hour] ??= []).push(p.engagement)
  }
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const bestDay    = Object.entries(dayEng).sort((a, b) => avg(b[1]) - avg(a[1]))[0]?.[0] ?? 'N/A'
  const bestFormat = Object.entries(fmtEng).sort((a, b) => avg(b[1]) - avg(a[1]))[0]?.[0] ?? 'N/A'
  const bestHourE  = Object.entries(hourEng).sort((a, b) => avg(b[1]) - avg(a[1]))[0]
  const bestHour   = bestHourE ? `${bestHourE[0]}h00` : 'N/A'

  const totalEngagement = allPosts.reduce((s, p) => s + p.engagement, 0)
  const avgEngagement   = allPosts.length > 0 ? Math.round(totalEngagement / allPosts.length) : 0

  const now    = new Date()
  const oldest = allPosts.length > 0 ? new Date(allPosts[allPosts.length - 1]!.isoDate) : now
  const mo     = months
  const week   = `${oldest.getDate()} ${mo[oldest.getMonth()]} — ${now.getDate()} ${mo[now.getMonth()]} ${now.getFullYear()}`

  return {
    week, source: 'scrape', posts: allPosts,
    profile: {
      username:   igProfile?.username       || '',
      fullName:   igProfile?.fullName       || '',
      followers:  igProfile?.followersCount || 0,
      following:  igProfile?.followsCount   || 0,
      postsCount: igProfile?.postsCount     || 0,
      bio:        igProfile?.biography      || '',
      profilePic: igProfile?.profilePicUrl  || '',
      fbFollowers: 0,
      fbPageName:  fbPageName,
    },
    analytics: {
      bestDay, bestFormat, bestHour,
      totalEngagement,
      totalLikes:    allPosts.reduce((s, p) => s + p.likes, 0),
      totalComments: allPosts.reduce((s, p) => s + p.comments, 0),
      totalViews:    allPosts.reduce((s, p) => s + p.views, 0),
      avgEngagement,
      postsAnalyzed: allPosts.length,
      igPosts: igPosts.length,
      fbPosts: fbPosts.length,
    },
    // Backward compat for brief generation
    followers: {
      instagram: igProfile?.followersCount || 0,
      igGrowth:  '',
      facebook:  0,
    },
    totalReach: allPosts.reduce((s, p) => s + p.views, 0) || totalEngagement,
    totalEngagement, bestDay, bestFormat,
  }
}
