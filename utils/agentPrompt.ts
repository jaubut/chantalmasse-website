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
  return `Voici les statistiques Meta de la semaine dernière pour Chantal Massé:

SEMAINE: ${insights.week}
ABONNÉS: Instagram ${insights.followers.instagram} (${insights.followers.igGrowth}) | Facebook ${insights.followers.facebook}
MEILLEUR JOUR: ${insights.bestDay}
MEILLEUR FORMAT: ${insights.bestFormat}
PORTÉE TOTALE: ${insights.totalReach.toLocaleString('fr-CA')}
ENGAGEMENT TOTAL: ${insights.totalEngagement.toLocaleString('fr-CA')}

DÉTAIL DES PUBLICATIONS:
${insights.posts.map((p: any) =>
  `- ${p.type} (${p.day}): ${p.reach.toLocaleString('fr-CA')} portée, ` +
  `${p.engagement} engagements, ${p.saves} sauvegardes, ` +
  `taux ${p.engagementRate}`
).join('\n')}

Génère le plan de publication pour la semaine prochaine.`
}
