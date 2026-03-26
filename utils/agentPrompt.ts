export const SYSTEM_PROMPT = `Tu es un agent marketing stratégique spécialisé pour Chantal Massé, thérapeute en relation d'aide et coach de couple basée à Shefford, Québec. Sa marque est chaleureuse, humaniste, non-judgementale et centrée sur le concept de l'Amour Conscient.

Ses 4 piliers de contenu sont:
1. Mythe vs Réalité (Reels) — déconstruire les idées reçues sur la thérapie
2. Q&R Instagram (Stories/Carrousels) — segments "Demandez à la thérapeute"
3. Micro-Défi (Carrousels) — exercices concrets pour les couples
4. Réflexions (Publications statiques) — citations et insights de couples anonymes

Partenariats stratégiques: Planificateurs de mariage, PAE corporatifs, Agents immobiliers.

FORMAT DE RÉPONSE OBLIGATOIRE:
Génère exactement 5 suggestions de publications pour la semaine.
Pour chaque publication, utilise ce format exact:

POST [numéro]:
JOUR: [jour de la semaine]
HEURE: [heure recommandée]
PILIER: [nom du pilier]
FORMAT: [Reel | Carrousel | Publication | Story]
ACCROCHE: [hook de légende en français, 1 ligne percutante]
POURQUOI: [2 phrases expliquant pourquoi ce post, ce jour, basé sur les données]

Termine par:
CONSEIL STRATÉGIQUE: [1 conseil lié à la stratégie de partenariat ou croissance]

Ton: chaleureux, stratégique, jamais corporatif.
Mélange naturel de français et d'expressions québécoises.`

export function buildWeeklyPrompt(insights: any): string {
  // Scrape source — rich per-post data
  if (insights.source === 'scrape') {
    const a       = insights.analytics || {}
    const posts   = insights.posts     || []
    const profile = insights.profile   || {}
    const fb      = insights.facebook  || null

    const postLines = posts.map((p: any, i: number) =>
      `  ${i + 1}. ${p.type} — ${p.day} ${p.date} à ${p.hour}h\n` +
      `     Pilier détecté: ${p.pillarMeta?.label || p.pillar}\n` +
      `     Engagement: ${p.engagement.toLocaleString('fr-CA')}` +
      (p.isReel ? ` vues` : ` (${p.likes} j'aime, ${p.comments} commentaires)`) + '\n' +
      `     Accroche: "${p.caption.slice(0, 100)}..."\n`
    ).join('\n')

    const fbSection = fb ? `\nFACEBOOK (données CSV):
  Vues:            ${(fb.views || 0).toLocaleString('fr-CA')}
  Interactions:    ${((fb.likes || 0) + (fb.comments || 0) + (fb.shares || 0)).toLocaleString('fr-CA')}
  Nouveaux abonnés:${(fb.newFollowers || 0).toLocaleString('fr-CA')}\n` : ''

    return `Analyse des ${posts.length} dernières publications Instagram de Chantal Massé:

PROFIL: @${profile.username} — ${profile.followers?.toLocaleString('fr-CA')} abonnés
${fbSection}
DONNÉES ANALYTIQUES:
  Meilleur jour:    ${a.bestDay}
  Meilleure heure:  ${a.bestHour}
  Meilleur format:  ${a.bestFormat}
  Engagement total: ${a.totalEngagement?.toLocaleString('fr-CA')}
  Engagement moyen: ${a.avgEngagement?.toLocaleString('fr-CA')} par publication
  Total vues:       ${a.totalViews?.toLocaleString('fr-CA')}
  Total j'aime:     ${a.totalLikes?.toLocaleString('fr-CA')}
  Total commentaires: ${a.totalComments?.toLocaleString('fr-CA')}

DÉTAIL DES PUBLICATIONS (du plus récent au plus ancien):
${postLines}

ANALYSE DEMANDÉE:
1. Identifie quels piliers de contenu performent le mieux
2. Identifie le meilleur créneau horaire et jour basé sur les données
3. Note quels types de posts (Reel/Carrousel/Publication) génèrent le plus d'engagement
4. Génère un plan de 5 publications pour la semaine prochaine
5. Pour chaque publication suggérée, inspire-toi des accroches qui ont le mieux performé

Génère le plan en suivant le format exact demandé.`
  }

  // CSV source — aggregate metrics
  const ig = insights.instagram || {}
  const fb = insights.facebook  || {}

  return `Statistiques de la semaine pour Chantal Massé (${insights.week}):

INSTAGRAM:
  Vues:              ${ig.views?.toLocaleString('fr-CA') || 0}
  Portée:            ${ig.reach?.toLocaleString('fr-CA') || 0}
  J'aime:            ${ig.likes?.toLocaleString('fr-CA') || 0}
  Commentaires:      ${ig.comments?.toLocaleString('fr-CA') || 0}
  Enregistrements:   ${ig.saves?.toLocaleString('fr-CA') || 0}
  Partages:          ${ig.shares?.toLocaleString('fr-CA') || 0}
  Clics sur le lien: ${ig.linkClicks?.toLocaleString('fr-CA') || 0}
  Visites du profil: ${ig.profileVisits?.toLocaleString('fr-CA') || 0}
  Nouveaux abonnés:  ${ig.newFollowers?.toLocaleString('fr-CA') || 0}

FACEBOOK:
  Vues:              ${fb.views?.toLocaleString('fr-CA') || 0}
  Viewers uniques:   ${fb.uniqueViewers?.toLocaleString('fr-CA') || 0}
  J'aime:            ${fb.likes?.toLocaleString('fr-CA') || 0}
  Commentaires:      ${fb.comments?.toLocaleString('fr-CA') || 0}
  Partages:          ${fb.shares?.toLocaleString('fr-CA') || 0}
  Clics sur le lien: ${fb.linkClicks?.toLocaleString('fr-CA') || 0}
  Visites de page:   ${fb.pageVisits?.toLocaleString('fr-CA') || 0}
  Nouveaux abonnés:  ${fb.newFollowers?.toLocaleString('fr-CA') || 0}

TAUX D'ENGAGEMENT GLOBAL: ${insights.engagementRate || '0%'}

Note importante: Les enregistrements Instagram et les partages
sont les métriques les plus précieuses pour la croissance organique
— priorise les formats qui génèrent ces actions.

Génère le plan de publication pour la semaine prochaine.`
}
