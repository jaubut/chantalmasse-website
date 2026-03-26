import { readMultipartFormData } from 'h3'
import { getCachedInsights, setCachedInsights, type MetaInsights } from '~/utils/metaApi'

export default defineEventHandler(async (event) => {
  const session = getCookie(event, 'admin_session')
  if (session !== 'authenticated') {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'Aucun fichier reçu' })
  }

  const parsed = parts
    .filter(p => p.data && p.filename)
    .map(p => parseMetricFile(
      Buffer.from(p.data).toString('utf-8'),
      p.filename!
    ))
    .filter(Boolean)

  // Debug: include per-file details in response
  const debugInfo = parsed.map(p => ({
    label: p?.label,
    type: p?.type,
    headers: p?._headers,
    firstRow: p?._firstRow,
    data: p?.data,
  }))

  const csvMetrics = mergeMetrics(parsed)

  // If there's a cached scrape result, preserve IG scrape data and only update FB metrics
  const existing = getCachedInsights() as any
  let insights: any

  if (existing?.source === 'scrape') {
    insights = {
      ...existing,
      csvInstagram: csvMetrics.instagram,
      facebook:     csvMetrics.facebook,
      filesLoaded:  csvMetrics.filesLoaded,
    }
    // Update followers.facebook if we got FB follow data
    if (csvMetrics.facebook?.newFollowers) {
      insights.followers = {
        ...existing.followers,
        facebook: csvMetrics.facebook.newFollowers,
      }
    }
  } else {
    insights = csvMetrics as MetaInsights
  }

  setCachedInsights(insights)

  return { success: true, insights, debug: debugInfo }
})

// ─── Detection ────────────────────────────────────────────────────────────────

function detectFileType(csv: string, filename: string): {
  type: string
  platform: 'instagram' | 'facebook'
  label: string
  emoji: string
} {
  const text = normalize(csv.slice(0, 800))
  const name = normalize(filename)

  const isFB = text.includes('facebook') || text.includes('page') || name.includes('facebook') || name.includes('fb')
  const isIG = text.includes('instagram') || name.includes('instagram') || name.includes('ig')

  // ── FACEBOOK ──────────────────────────────────────────────────────────────
  // Facebook Viewers (check before Views)
  if ((text.includes('viewer') || text.includes('personne') || name.includes('viewer')) && isFB && !isIG)
    return { type: 'fb_viewers', platform: 'facebook', label: 'Viewers Facebook', emoji: '👁' }

  // Facebook Views
  if (isFB && !isIG &&
      (name.includes('view') || name.includes('vue') || text.includes('video view') || text.includes('vue') || text.includes('page view') || text.includes('impression')))
    return { type: 'fb_views', platform: 'facebook', label: 'Vues Facebook', emoji: '👁' }

  // Facebook Interactions (reaction/j'aime/like/comment/partage/share)
  if (isFB && !isIG &&
      (name.includes('interaction') || text.includes('reaction') || text.includes('j\'aime') || text.includes('jaime') || text.includes('content interaction') || text.includes('publication')))
    return { type: 'fb_interactions', platform: 'facebook', label: 'Interactions Facebook', emoji: '💬' }

  // Facebook Link Clicks
  if (isFB && !isIG &&
      (name.includes('link') || name.includes('clic') || text.includes('link click') || text.includes('clic sur') || text.includes('lien')))
    return { type: 'fb_link_clicks', platform: 'facebook', label: 'Clics Facebook', emoji: '🔗' }

  // Facebook Visits
  if (isFB && !isIG &&
      (name.includes('visit') || text.includes('page visit') || text.includes('visite')))
    return { type: 'fb_visits', platform: 'facebook', label: 'Visites Facebook', emoji: '🏠' }

  // Facebook Follows
  if (isFB && !isIG &&
      (name.includes('follow') || name.includes('abonn') || text.includes('new follower') || text.includes('page like') || text.includes('fan') || text.includes('abonn')))
    return { type: 'fb_follows', platform: 'facebook', label: 'Abonnés Facebook', emoji: '👥' }

  // ── INSTAGRAM ─────────────────────────────────────────────────────────────
  // Instagram Views
  if (name.includes('view') || name.includes('vue') ||
      (text.includes('view') && !text.includes('viewer')) ||
      text.includes('impression'))
    return { type: 'ig_views', platform: 'instagram', label: 'Vues Instagram', emoji: '👁' }

  // Instagram Reach
  if (name.includes('reach') || name.includes('portee') || text.includes('reach') || text.includes('portee') || text.includes('account reached') || text.includes('compte touche'))
    return { type: 'ig_reach', platform: 'instagram', label: 'Portée Instagram', emoji: '📊' }

  // Instagram Interactions
  if (name.includes('interaction') || text.includes('like') || text.includes('jaime') || text.includes('content interaction') ||
      text.includes('save') || text.includes('enregistrement'))
    return { type: 'ig_interactions', platform: 'instagram', label: 'Interactions Instagram', emoji: '💬' }

  // Instagram Link Clicks
  if (name.includes('link') || name.includes('clic') || text.includes('link click') || text.includes('clic sur le lien') || text.includes('lien'))
    return { type: 'ig_link_clicks', platform: 'instagram', label: 'Clics Instagram', emoji: '🔗' }

  // Instagram Visits
  if (name.includes('visit') || text.includes('profile visit') || text.includes('visite') || text.includes('account visit') || text.includes('compte visite'))
    return { type: 'ig_visits', platform: 'instagram', label: 'Visites Instagram', emoji: '🏠' }

  // Instagram Follows
  if (name.includes('follow') || name.includes('abonn') || text.includes('follower') || text.includes('abonn') || text.includes('new follow'))
    return { type: 'ig_follows', platform: 'instagram', label: 'Abonnés Instagram', emoji: '👥' }

  return { type: 'unknown', platform: 'instagram', label: 'Non reconnu', emoji: '❓' }
}

// ─── Value extractor ──────────────────────────────────────────────────────────

function extractValue(
  rows: Record<string, string>[],
  headers: string[],
  keywords: string[]
): number {
  const normKeywords = keywords.map(normalize)

  // FORMAT C — row where first column matches keyword
  for (const row of rows) {
    const firstVal = normalize(Object.values(row)[0] || '')
    if (normKeywords.some(kw => firstVal.includes(kw))) {
      const nums = Object.values(row)
        .map(v => parseInt(v.replace(/[^0-9]/g, '')))
        .filter(n => !isNaN(n) && n >= 0)
      if (nums.length > 0) return nums[nums.length - 1] ?? 0
    }
  }

  // FORMAT A — sum the value column
  const valueCol = headers.find(h =>
    h.includes('value') || h.includes('valeur') ||
    h.includes('count') || h.includes('total') ||
    normKeywords.some(kw => h.includes(kw))
  )
  if (valueCol) {
    return rows.reduce((sum, row) => {
      const n = parseInt((row[valueCol] || '').replace(/[^0-9]/g, ''))
      return sum + (isNaN(n) ? 0 : n)
    }, 0)
  }

  // FORMAT B — find column named "total" or sum last numeric column
  const totalCol = headers.find(h => h.includes('total'))
  if (totalCol) {
    return rows.reduce((sum, row) => {
      const n = parseInt((row[totalCol] || '').replace(/[^0-9]/g, ''))
      return sum + (isNaN(n) ? 0 : n)
    }, 0)
  }

  // Last resort — sum last column
  const lastHeader = headers[headers.length - 1] ?? ''
  return rows.reduce((sum, row) => {
    const n = parseInt((row[lastHeader] || '').replace(/[^0-9]/g, ''))
    return sum + (isNaN(n) ? 0 : n)
  }, 0)
}

// ─── Per-file parser ──────────────────────────────────────────────────────────

// Normalize accented French characters for keyword matching
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
}

function parseMetricFile(csv: string, filename: string) {
  const text = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const allLines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (allLines.length < 2) return null

  // Auto-detect separator: count occurrences in first few lines
  const sample = allLines.slice(0, 3).join('\n')
  const commas     = (sample.match(/,/g) || []).length
  const semicolons = (sample.match(/;/g) || []).length
  const tabs       = (sample.match(/\t/g) || []).length
  const sep = tabs > commas && tabs > semicolons ? '\t'
    : semicolons > commas ? ';'
    : ','

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let cur = '', inQ = false
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue }
      if (c === sep && !inQ) { result.push(cur.trim()); cur = ''; continue }
      cur += c
    }
    result.push(cur.trim())
    return result
  }

  // Skip title/metadata rows: find the first line that has multiple columns (likely the header row)
  let headerIdx = 0
  for (let i = 0; i < Math.min(allLines.length - 1, 5); i++) {
    const cols = parseRow(allLines[i] ?? '')
    if (cols.length >= 2) { headerIdx = i; break }
  }

  const lines = allLines.slice(headerIdx)
  if (lines.length < 2) return null

  const headers = parseRow(lines[0] ?? '').map(h => normalize(h))
  const rows = lines.slice(1).map(l => {
    const vals = parseRow(l)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']))
  })

  const detected = detectFileType(csv, filename)
  const data: Record<string, number> = {}

  switch (detected.type) {
    case 'ig_views':
    case 'fb_views':
      data.views = extractValue(rows, headers, ['view', 'vue', 'impression', 'total'])
      break

    case 'fb_viewers':
      data.viewers = extractValue(rows, headers, ['viewer', 'unique', 'person', 'personne'])
      break

    case 'ig_reach':
      data.reach = extractValue(rows, headers, ['reach', 'portée', 'account reached', 'compte touché'])
      break

    case 'ig_interactions':
    case 'fb_interactions':
      data.likes    = extractValue(rows, headers, ['like', "j'aime", 'mention', 'réaction', 'reaction'])
      data.comments = extractValue(rows, headers, ['comment', 'commentaire'])
      data.saves    = extractValue(rows, headers, ['save', 'enregistrement', 'bookmark'])
      data.shares   = extractValue(rows, headers, ['share', 'partage'])
      data.total    = data.likes + data.comments + data.saves + data.shares
      break

    case 'ig_link_clicks':
    case 'fb_link_clicks':
      data.clicks = extractValue(rows, headers, ['click', 'clic', 'link', 'lien'])
      break

    case 'ig_visits':
    case 'fb_visits':
      data.visits = extractValue(rows, headers, ['visit', 'visite', 'profile', 'page view'])
      break

    case 'ig_follows':
    case 'fb_follows': {
      const allVals = rows
        .map(r => {
          const nums = Object.values(r)
            .map(v => parseInt(v.replace(/[^0-9]/g, '')))
            .filter(n => !isNaN(n) && n > 0)
          return Math.max(...nums, 0)
        })
        .filter(n => n > 0)
      const maxVal = Math.max(...allVals, 0)
      const sumVal = allVals.reduce((s, n) => s + n, 0)
      data.count = maxVal > 500 ? maxVal : sumVal
      break
    }
  }

  return { ...detected, data, _headers: headers, _firstRow: rows[0] ?? {} }
}

// ─── Merge ────────────────────────────────────────────────────────────────────

function mergeMetrics(metrics: ReturnType<typeof parseMetricFile>[]) {
  const get = (type: string) => metrics.find(m => m?.type === type)?.data || {}

  const igViews        = get('ig_views')
  const igReach        = get('ig_reach')
  const igInteractions = get('ig_interactions')
  const igClicks       = get('ig_link_clicks')
  const igVisits       = get('ig_visits')
  const igFollows      = get('ig_follows')

  const fbViews        = get('fb_views')
  const fbViewers      = get('fb_viewers')
  const fbInteractions = get('fb_interactions')
  const fbClicks       = get('fb_link_clicks')
  const fbVisits       = get('fb_visits')
  const fbFollows      = get('fb_follows')

  const totalReach      = igReach.reach || 0
  const totalEngagement = (igInteractions.total || 0) + (fbInteractions.total || 0)
  const engRate = totalReach > 0
    ? ((totalEngagement / totalReach) * 100).toFixed(1) + '%'
    : '0%'

  const now = new Date()
  const ws  = new Date(now)
  ws.setDate(now.getDate() - 7)
  const mo = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']
  const week = `${ws.getDate()} ${mo[ws.getMonth()]} — ${now.getDate()} ${mo[now.getMonth()]} ${now.getFullYear()}`

  return {
    week,
    source: 'csv',
    filesLoaded: metrics.filter(Boolean).map(m => m!.label).join(', '),

    instagram: {
      views:         igViews.views || 0,
      reach:         igReach.reach || 0,
      likes:         igInteractions.likes || 0,
      comments:      igInteractions.comments || 0,
      saves:         igInteractions.saves || 0,
      shares:        igInteractions.shares || 0,
      linkClicks:    igClicks.clicks || 0,
      profileVisits: igVisits.visits || 0,
      newFollowers:  igFollows.count || 0,
    },

    facebook: {
      views:         fbViews.views || 0,
      uniqueViewers: fbViewers.viewers || 0,
      likes:         fbInteractions.likes || 0,
      comments:      fbInteractions.comments || 0,
      shares:        fbInteractions.shares || 0,
      linkClicks:    fbClicks.clicks || 0,
      pageVisits:    fbVisits.visits || 0,
      newFollowers:  fbFollows.count || 0,
    },

    totalReach,
    totalEngagement,
    engagementRate: engRate,

    followers: {
      instagram: igFollows.count || 0,
      igGrowth:  '',
      facebook:  fbFollows.count || 0,
    },

    bestDay:    'N/A',
    bestFormat: 'N/A',
    posts:      [],
  }
}
