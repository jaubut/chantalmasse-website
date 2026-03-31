import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { SYSTEM_PROMPT, buildWeeklyPrompt } from '../../utils/agentPrompt'

export interface BriefClientConfig {
  igUsername: string
  fbUsername?: string
  briefEmail: string
  apifyToken?: string
  anthropicKey?: string
  resendKey?: string
  emailFrom?: string
}

// ── Instagram / Facebook scraping via Apify ───────────────────────────────────

export async function scrapeInstagram(config: BriefClientConfig): Promise<any> {
  const token = config.apifyToken || process.env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN is not configured')

  const fbUser = config.fbUsername || config.igUsername

  const [igRunRes, fbRunRes] = await Promise.all([
    startApifyRun(token, 'apify~instagram-profile-scraper', {
      usernames: [config.igUsername],
      resultsLimit: 12,
      scrapeType: 'posts',
    }),
    startApifyRun(token, 'apify~facebook-posts-scraper', {
      startUrls: [{ url: `https://www.facebook.com/${fbUser}` }],
      maxPosts: 12,
    }).catch(() => null),
  ])

  const igRunId = igRunRes?.data?.id
  if (!igRunId) throw new Error('Failed to start Instagram scraper')

  const [igStatus, fbStatus] = await Promise.all([
    pollRun(token, 'apify~instagram-profile-scraper', igRunId, 15),
    fbRunRes?.data?.id
      ? pollRun(token, 'apify~facebook-posts-scraper', fbRunRes.data.id, 15).catch(() => 'FAILED')
      : Promise.resolve('SKIPPED'),
  ])

  if (igStatus !== 'SUCCEEDED') {
    throw new Error('Instagram scrape timed out — retry in a few minutes')
  }

  const [igItems, fbItems] = await Promise.all([
    fetchDataset(token, igRunRes.data.defaultDatasetId),
    fbRunRes?.data?.defaultDatasetId && fbStatus === 'SUCCEEDED'
      ? fetchDataset(token, fbRunRes.data.defaultDatasetId).catch(() => [])
      : Promise.resolve([]),
  ])

  const igProfile = igItems.find((i: any) => i.followersCount !== undefined)
  if (!igProfile) throw new Error(`Account @${config.igUsername} not found or is private`)

  const igPosts: any[] = Array.isArray(igProfile.latestPosts) ? igProfile.latestPosts : []
  if (igPosts.length === 0) {
    throw new Error(`Profile @${config.igUsername} found but no posts retrieved`)
  }

  const fbPosts: any[] = Array.isArray(fbItems) ? fbItems : []
  const fbPage = fbPosts[0] ?? null

  return buildInsightsFromScrape(igProfile, igPosts, fbPage, fbPosts)
}

// ── Claude brief generation ───────────────────────────────────────────────────

export async function generateBrief(insights: any, customPrompt?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

  const client = new Anthropic({ apiKey })
  const userMessage = stripLoneSurrogates(buildWeeklyPrompt(insights))

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: customPrompt || SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const firstBlock = message.content[0]
  return firstBlock?.type === 'text' ? firstBlock.text : ''
}

// ── Resend email delivery ─────────────────────────────────────────────────────

export async function sendBriefEmail(briefText: string, config: BriefClientConfig): Promise<void> {
  const apiKey = config.resendKey || process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

  const resend = new Resend(apiKey)
  const from = config.emailFrom || process.env.EMAIL_FROM || 'hello@tech-lab.studio'
  const monday = getMondayDate()

  const { error } = await resend.emails.send({
    from,
    to: config.briefEmail,
    subject: `📋 Brief Marketing — Semaine du ${monday}`,
    html: buildBriefEmailHtml(briefText, monday),
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
  console.log(`[brief] Email sent → ${config.briefEmail}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripLoneSurrogates(str: string): string {
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
}

function getMondayDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildBriefEmailHtml(brief: string, weekDate: string): string {
  const escaped = brief
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf7f3;font-family:Manrope,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#173028;border-radius:16px;padding:32px;margin-bottom:24px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;margin:0 0 8px;font-style:italic;">Chantal Massé</h1>
      <p style="color:#cce9dd;margin:0;font-size:14px;">Brief Marketing IA</p>
    </div>
    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f0ebe4;">
      <h2 style="color:#173028;font-size:18px;margin:0 0 8px;">Semaine du ${weekDate}</h2>
      <p style="color:#727975;font-size:13px;margin:0 0 24px;">Généré automatiquement par l'agent IA</p>
      <div style="color:#1d1b19;font-size:15px;line-height:1.7;">${escaped}</div>
    </div>
    <p style="text-align:center;color:#a0a0a0;font-size:12px;margin-top:24px;">
      Chantal Massé — Thérapeute en relation d'aide · Shefford, Québec
    </p>
  </div>
</body>
</html>`
}

// ── Apify HTTP helpers ────────────────────────────────────────────────────────

async function startApifyRun(token: string, actor: string, input: object): Promise<any> {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  return res.json()
}

async function pollRun(token: string, actor: string, runId: string, maxAttempts: number): Promise<string> {
  let attempts = 0
  let status = 'RUNNING'
  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await fetch(`https://api.apify.com/v2/acts/${actor}/runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    status = data?.data?.status ?? 'FAILED'
    attempts++
  }
  return status
}

async function fetchDataset(token: string, datasetId: string): Promise<any[]> {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// ── Insights builder (extracted from scrape-instagram.post.ts) ────────────────

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
    const raw  = p.time || ''
    const date = raw ? new Date(raw) : new Date()
    const likes    = p.likes ?? 0
    const comments = p.comments ?? 0
    const shares   = typeof p.shares === 'number' ? p.shares : 0
    const engagement = likes + comments + shares
    const pillar     = detectPillar(p.text || '')
    const thumbnailUrl = p.media?.[0]?.thumbnail || p.media?.[0]?.large_share_image?.uri || ''
    return {
      id: p.postId || p.url || String(Math.random()),
      shortCode: null, url: p.url || '',
      thumbnailUrl, type: 'Publication',
      platform: 'Facebook', pillar, pillarMeta: pillarMeta[pillar],
      likes, comments, shares, views: 0, engagement, saves: 0, reach: engagement,
      engagementRate: '—',
      day: days[date.getDay()] ?? '', hour: date.getHours(),
      date: `${date.getDate()} ${months[date.getMonth()]}`,
      isoDate: raw || new Date().toISOString(),
      caption: (p.text || '').slice(0, 200),
      hashtags: [], isReel: false, isCarousel: false,
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
      fbPageName,
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
    followers: {
      instagram: igProfile?.followersCount || 0,
      igGrowth:  '',
      facebook:  0,
    },
    totalReach: allPosts.reduce((s, p) => s + p.views, 0) || totalEngagement,
    totalEngagement, bestDay, bestFormat,
  }
}
