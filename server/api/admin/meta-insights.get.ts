import {
  getMockInsights,
  getCachedInsights,
  setCachedInsights,
  detectPillar,
  mediaTypeToLabel,
  type MetaInsights,
  type MetaPost,
} from '~/utils/metaApi'

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export default defineEventHandler(async (event) => {
  // Auth check
  const session = getCookie(event, 'admin_session')
  if (session !== 'authenticated') {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  // Cache hit
  const cached = getCachedInsights()
  if (cached) return cached

  const config = useRuntimeConfig()
  const token = config.metaAccessToken
  const igUserId = config.metaIgUserId
  const fbPageId = config.metaFbPageId

  // Return mock data if not configured
  if (!token || !igUserId) {
    const mock = getMockInsights()
    return mock
  }

  try {
    const base = 'https://graph.facebook.com/v19.0'

    // 1. Instagram follower count
    const igProfile = await $fetch<{ followers_count: number; name: string }>(
      `${base}/${igUserId}?fields=followers_count,name&access_token=${token}`
    )

    // 2. Instagram recent media
    const mediaRes = await $fetch<{ data: any[] }>(
      `${base}/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count&limit=10&access_token=${token}`
    )

    // 3. Per-media insights
    const postsWithInsights: MetaPost[] = []
    for (const media of mediaRes.data || []) {
      try {
        const insightsRes = await $fetch<{ data: any[] }>(
          `${base}/${media.id}/insights?metric=reach,impressions,saved,engagement&access_token=${token}`
        )
        const metrics: Record<string, number> = {}
        for (const m of insightsRes.data || []) {
          metrics[m.name] = m.values?.[0]?.value ?? m.value ?? 0
        }
        const reach = metrics.reach || 0
        const engagement = metrics.engagement || (media.like_count || 0) + (media.comments_count || 0)
        const saves = metrics.saved || 0
        const rate = reach > 0 ? ((engagement / reach) * 100).toFixed(1) + '%' : '0%'
        const date = new Date(media.timestamp)

        postsWithInsights.push({
          id: media.id,
          type: mediaTypeToLabel(media.media_type),
          platform: 'Instagram',
          pillar: detectPillar(media.caption || ''),
          reach,
          engagement,
          saves,
          engagementRate: rate,
          day: DAYS_FR[date.getDay()] ?? 'Lundi',
          caption: (media.caption || '').slice(0, 100),
          timestamp: media.timestamp,
        })
      } catch {
        // Skip media items that fail insights fetch
      }
    }

    // 4. Facebook page fan count
    let fbFans = 0
    if (fbPageId) {
      try {
        const fbPage = await $fetch<{ fan_count: number }>(
          `${base}/${fbPageId}?fields=fan_count&access_token=${token}`
        )
        fbFans = fbPage.fan_count || 0
      } catch { /* ignore */ }
    }

    // Compute bestDay and bestFormat
    const dayEngagement: Record<string, number> = {}
    const formatEngagement: Record<string, number> = {}
    let totalReach = 0
    let totalEngagement = 0

    for (const p of postsWithInsights) {
      dayEngagement[p.day] = (dayEngagement[p.day] || 0) + p.engagement
      formatEngagement[p.type] = (formatEngagement[p.type] || 0) + p.engagement
      totalReach += p.reach
      totalEngagement += p.engagement
    }

    const bestDay = Object.entries(dayEngagement).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Mardi'
    const bestFormat = Object.entries(formatEngagement).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Reel'

    // Build week label
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) - 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) => d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })
    const week = `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`

    const result: MetaInsights = {
      week,
      posts: postsWithInsights,
      followers: {
        instagram: igProfile.followers_count || 0,
        igGrowth: '+0 cette semaine',
        facebook: fbFans,
      },
      bestDay,
      bestFormat,
      totalReach,
      totalEngagement,
    }

    setCachedInsights(result)
    return result
  } catch (err: any) {
    // If Meta API fails, fall back to mock data
    console.error('[meta-insights] API error, falling back to mock:', err?.message)
    return getMockInsights()
  }
})
