import { getCachedInsights, setCachedInsights } from '~/utils/metaApi'

export default defineEventHandler(async (event) => {
  const session = getCookie(event, 'admin_session')
  if (session !== 'authenticated') {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const { username } = await readBody(event)
  if (!username) {
    throw createError({ statusCode: 400, message: 'Username requis' })
  }

  const config = useRuntimeConfig()
  if (!config.apifyApiToken) {
    throw createError({
      statusCode: 503,
      message: 'Configurez votre token Apify dans le fichier .env (APIFY_API_TOKEN) pour activer l\'analyse automatique.',
    })
  }

  // Start Apify actor run
  const runRes = await $fetch<any>(
    'https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apifyApiToken}`,
      },
      body: JSON.stringify({
        usernames: [username],
        resultsLimit: 12,
        scrapeType: 'posts',
      }),
    }
  )

  const runId = runRes.data?.id
  if (!runId) {
    throw createError({ statusCode: 502, message: 'Impossible de démarrer le scraper' })
  }

  // Poll for completion (max 45 seconds)
  let attempts = 0
  let status = 'RUNNING'

  while (status === 'RUNNING' && attempts < 15) {
    await new Promise(r => setTimeout(r, 3000))

    const statusRes = await $fetch<any>(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs/${runId}`,
      { headers: { 'Authorization': `Bearer ${config.apifyApiToken}` } }
    )
    status = statusRes.data?.status ?? 'FAILED'
    attempts++
  }

  if (status !== 'SUCCEEDED') {
    throw createError({
      statusCode: 504,
      message: 'L\'analyse a pris trop de temps. Instagram ralentit parfois les scrapers. Réessayez dans quelques minutes.',
    })
  }

  const datasetId = runRes.data?.defaultDatasetId
  const results = await $fetch<any>(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`,
    { headers: { 'Authorization': `Bearer ${config.apifyApiToken}` } }
  )

  const items: any[] = Array.isArray(results) ? results : []

  if (items.length === 0) {
    throw createError({
      statusCode: 404,
      message: `Aucune publication trouvée pour @${username}. Vérifiez que le compte est public.`,
    })
  }

  const profile = items.find(i => i.followersCount !== undefined)
  const posts   = items.filter(i => i.likesCount !== undefined || i.videoViewCount !== undefined)

  if (posts.length === 0) {
    throw createError({
      statusCode: 404,
      message: `Le compte @${username} est introuvable ou est privé.`,
    })
  }

  const scrapeInsights = buildInsightsFromScrape(profile, posts)

  // Preserve any Facebook CSV data from previous cache
  const existing = getCachedInsights()
  if (existing?.facebook) {
    ;(scrapeInsights as any).facebook = existing.facebook
    ;(scrapeInsights as any).filesLoaded = existing.filesLoaded
  }

  setCachedInsights(scrapeInsights as any)

  return { success: true, insights: scrapeInsights }
})

function buildInsightsFromScrape(profile: any, posts: any[]) {
  const days   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const months = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']

  const parsedPosts = posts.map(p => {
    const date    = new Date(p.timestamp)
    const isReel  = p.isVideo || p.type === 'Video'

    const typeMap: Record<string, string> = {
      Video:   'Reel',
      Image:   'Publication',
      Sidecar: 'Carrousel',
    }
    const postType = typeMap[p.type] || 'Publication'

    const likes    = p.likesCount    || 0
    const comments = p.commentsCount || 0
    const views    = p.videoViewCount || 0

    const engagement = isReel ? views + comments : likes + comments
    const reach      = isReel ? views : likes + comments
    const engRate    = reach > 0 ? ((engagement / reach) * 100).toFixed(1) + '%' : '0%'

    const cap = (p.caption || '').toLowerCase()
    let pillar = 'general'
    if (/mythe|vrai|faux|réalité/.test(cap))                           pillar = 'myth'
    else if (/défi|exercice|essayez|cette semaine/.test(cap))          pillar = 'challenge'
    else if (/question|répondez|dites-moi|vous \?/.test(cap))          pillar = 'qa'
    else if (/amour|réflexion|conscient|sagesse|connexion/.test(cap))  pillar = 'reflection'

    const pillarMeta: Record<string, { label: string; emoji: string; color: string }> = {
      myth:       { label: 'Mythe vs Réalité', emoji: '⚡', color: '#7B5EA7' },
      challenge:  { label: 'Micro-Défi',       emoji: '📅', color: '#3D9970' },
      qa:         { label: 'Q&R',              emoji: '💬', color: '#E07A5F' },
      reflection: { label: 'Réflexion',        emoji: '✨', color: '#C9A84C' },
      general:    { label: 'Général',          emoji: '📝', color: '#727975' },
    }

    return {
      id:           p.id || p.shortCode,
      shortCode:    p.shortCode,
      url:          p.url,
      thumbnailUrl: p.displayUrl,
      type:         postType,
      platform:     'Instagram',
      pillar,
      pillarMeta:   pillarMeta[pillar],
      likes,
      comments,
      views,
      engagement,
      saves:        0,
      reach,
      engagementRate: engRate,
      day:          days[date.getDay()] ?? '',
      hour:         date.getHours(),
      date:         `${date.getDate()} ${months[date.getMonth()]}`,
      isoDate:      p.timestamp,
      caption:      (p.caption || '').slice(0, 200),
      hashtags:     p.hashtags || [],
      isReel,
      isCarousel:   p.type === 'Sidecar',
    }
  })

  // Analytics
  const dayEng: Record<string, number[]> = {}
  const fmtEng: Record<string, number[]> = {}
  const hourEng: Record<number, number[]> = {}

  for (const p of parsedPosts) {
    ;(dayEng[p.day]    ??= []).push(p.engagement)
    ;(fmtEng[p.type]   ??= []).push(p.engagement)
    ;(hourEng[p.hour]  ??= []).push(p.engagement)
  }

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

  const bestDay = Object.entries(dayEng)
    .sort((a, b) => avg(b[1]) - avg(a[1]))[0]?.[0] ?? 'N/A'

  const bestFormat = Object.entries(fmtEng)
    .sort((a, b) => avg(b[1]) - avg(a[1]))[0]?.[0] ?? 'N/A'

  const bestHourEntry = Object.entries(hourEng)
    .sort((a, b) => avg(b[1]) - avg(a[1]))[0]
  const bestHour = bestHourEntry ? `${bestHourEntry[0]}h00` : 'N/A'

  const totalEngagement = parsedPosts.reduce((s, p) => s + p.engagement, 0)
  const totalLikes      = parsedPosts.reduce((s, p) => s + p.likes, 0)
  const totalComments   = parsedPosts.reduce((s, p) => s + p.comments, 0)
  const totalViews      = parsedPosts.reduce((s, p) => s + p.views, 0)
  const avgEngagement   = parsedPosts.length > 0 ? Math.round(totalEngagement / parsedPosts.length) : 0

  const now    = new Date()
  const oldest = parsedPosts.length > 0 ? new Date(parsedPosts[parsedPosts.length - 1]!.isoDate) : now
  const mo     = months
  const week   = `${oldest.getDate()} ${mo[oldest.getMonth()]} — ${now.getDate()} ${mo[now.getMonth()]} ${now.getFullYear()}`

  return {
    week,
    source: 'scrape',
    posts:  parsedPosts,

    profile: {
      username:   profile?.username    || '',
      fullName:   profile?.fullName    || '',
      followers:  profile?.followersCount || 0,
      following:  profile?.followsCount   || 0,
      postsCount: profile?.postsCount     || 0,
      bio:        profile?.biography      || '',
      profilePic: profile?.profilePicUrl  || '',
    },

    analytics: {
      bestDay,
      bestFormat,
      bestHour,
      totalEngagement,
      totalLikes,
      totalComments,
      totalViews,
      avgEngagement,
      postsAnalyzed: parsedPosts.length,
    },

    // Backward compat for brief generation
    followers: {
      instagram: profile?.followersCount || 0,
      igGrowth:  '',
      facebook:  0,
    },
    totalReach:      totalViews || totalEngagement,
    totalEngagement,
    bestDay,
    bestFormat,
  }
}
