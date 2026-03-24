export interface MetaPost {
  id: string
  type: string
  platform: string
  pillar: string
  reach: number
  engagement: number
  saves: number
  engagementRate: string
  day: string
  caption: string
  timestamp: string
}

export interface MetaInsights {
  week: string
  posts: MetaPost[]
  followers: {
    instagram: number
    igGrowth: string
    facebook: number
  }
  bestDay: string
  bestFormat: string
  totalReach: number
  totalEngagement: number
  isMockData?: boolean
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export function detectPillar(caption: string): string {
  const lower = (caption || '').toLowerCase()
  if (/mythe|réalité|realite|vrai|faux/.test(lower)) return 'myth'
  if (/défi|defi|exercice|essayez/.test(lower)) return 'challenge'
  if (/question|répondez|repondez|dites-moi/.test(lower)) return 'qa'
  if (/réflexion|reflexion|pensée|pensee|sagesse/.test(lower)) return 'reflection'
  return 'general'
}

export function mediaTypeToLabel(type: string): string {
  switch (type?.toUpperCase()) {
    case 'VIDEO': return 'Reel'
    case 'CAROUSEL_ALBUM': return 'Carrousel'
    case 'IMAGE': return 'Publication'
    default: return 'Publication'
  }
}

export function getMockInsights(): MetaInsights {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) - 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })

  return {
    week: `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`,
    posts: [
      {
        id: 'mock_1',
        type: 'Reel',
        platform: 'Instagram',
        pillar: 'myth',
        reach: 1840,
        engagement: 112,
        saves: 47,
        engagementRate: '6.1%',
        day: 'Mardi',
        caption: '🧠 MYTHE: "La thérapie c\'est juste pour les gens en crise." On déconstruit ça aujourd\'hui…',
        timestamp: new Date(monday.getTime() + 86400000).toISOString(),
      },
      {
        id: 'mock_2',
        type: 'Carrousel',
        platform: 'Instagram',
        pillar: 'challenge',
        reach: 1240,
        engagement: 89,
        saves: 63,
        engagementRate: '7.2%',
        day: 'Jeudi',
        caption: '💑 Micro-défi du jeudi: 5 minutes de connexion profonde avec votre partenaire…',
        timestamp: new Date(monday.getTime() + 3 * 86400000).toISOString(),
      },
      {
        id: 'mock_3',
        type: 'Story',
        platform: 'Instagram',
        pillar: 'qa',
        reach: 680,
        engagement: 34,
        saves: 8,
        engagementRate: '5.0%',
        day: 'Mercredi',
        caption: '❓ Vous avez des questions sur la thérapie de couple? Posez-les ici…',
        timestamp: new Date(monday.getTime() + 2 * 86400000).toISOString(),
      },
      {
        id: 'mock_4',
        type: 'Publication',
        platform: 'Instagram',
        pillar: 'reflection',
        reach: 920,
        engagement: 67,
        saves: 31,
        engagementRate: '7.3%',
        day: 'Vendredi',
        caption: '✨ "On ne tombe pas amoureux, on grandit ensemble dans l\'amour." — Un couple anonyme…',
        timestamp: new Date(monday.getTime() + 4 * 86400000).toISOString(),
      },
      {
        id: 'mock_5',
        type: 'Publication',
        platform: 'Facebook',
        pillar: 'general',
        reach: 540,
        engagement: 28,
        saves: 12,
        engagementRate: '5.2%',
        day: 'Lundi',
        caption: 'Nouvelle semaine, nouvelle intention. Comment vous connectez-vous avec vous-même ce lundi?',
        timestamp: monday.toISOString(),
      },
    ],
    followers: {
      instagram: 2847,
      igGrowth: '+14 cette semaine',
      facebook: 1203,
    },
    bestDay: 'Mardi',
    bestFormat: 'Reel',
    totalReach: 5220,
    totalEngagement: 330,
    isMockData: true,
  }
}

// In-memory cache
let insightsCache: { data: MetaInsights; expiresAt: number } | null = null

export function getCachedInsights(): MetaInsights | null {
  if (insightsCache && Date.now() < insightsCache.expiresAt) {
    return insightsCache.data
  }
  return null
}

export function setCachedInsights(data: MetaInsights): void {
  insightsCache = { data, expiresAt: Date.now() + 15 * 60 * 1000 }
}
