export interface BentoCard {
  title: string
  description: string
  span: 'single' | 'wide' | 'tall' | 'large'
  icon?: string
}

export interface JourneySection {
  id: string
  label: string
  headline: string
  subtext: string
  cards: BentoCard[]
}

export const journeyHero = {
  headline: 'Le chemin vers toi-même commence ici.',
  subtext: 'La thérapie, c\'est pas un aveu de faiblesse. C\'est le geste le plus courageux que tu peux poser pour toi, pour ta relation, pour ta famille.',
  scrollLabel: 'Découvrir le parcours',
}

export const journeySections: JourneySection[] = [
  {
    id: 'reconnaitre',
    label: '01 — Reconnaître',
    headline: 'Ce que tu vis est réel.',
    subtext: 'Tu n\'as pas besoin d\'être en crise pour mériter de l\'aide. Ces signaux, tu les connais peut-être déjà.',
    cards: [
      {
        title: 'Tu te sens déconnecté·e',
        description: 'De ton partenaire, de toi-même, de ce qui comptait avant. Les conversations tournent en rond ou n\'existent plus.',
        span: 'wide',
        icon: 'material-symbols:link-off',
      },
      {
        title: 'L\'anxiété s\'installe',
        description: 'Boule dans le ventre, pensées qui bouclent, sommeil qui fuit. Le corps parle quand les mots manquent.',
        span: 'single',
        icon: 'material-symbols:waves',
      },
      {
        title: 'Tu portes tout seul·e',
        description: 'La charge mentale, les non-dits, les frustrations accumulées. Chaque jour ajoute un poids.',
        span: 'single',
        icon: 'material-symbols:fitness-center',
      },
      {
        title: 'Les conflits se répètent',
        description: 'Les mêmes disputes, les mêmes blessures. Vous savez que ça ne fonctionne plus, mais vous ne savez pas comment en sortir.',
        span: 'wide',
        icon: 'material-symbols:replay',
      },
    ],
  },
  {
    id: 'comprendre',
    label: '02 — Comprendre',
    headline: 'La thérapie, c\'est quoi concrètement?',
    subtext: 'Pas de divan. Pas de jugement. Un espace sécuritaire où tu peux enfin déposer ce que tu portes.',
    cards: [
      {
        title: 'Un premier appel gratuit',
        description: 'On jase 15 minutes. Tu poses tes questions, tu vois si le feeling est là. Aucun engagement.',
        span: 'single',
        icon: 'material-symbols:phone-in-talk',
      },
      {
        title: 'En personne ou en vidéo',
        description: 'À Shefford dans un bureau chaleureux, ou confortablement chez toi via Google Meet. Toi qui choisis.',
        span: 'single',
        icon: 'material-symbols:video-camera-front',
      },
      {
        title: 'Des approches qui ont fait leurs preuves',
        description: 'Thérapie Imago pour les couples, relation d\'aide pour les individus, neurosciences pour comprendre tes réactions. Chaque outil est choisi pour toi, pas appliqué de façon générique.',
        span: 'wide',
        icon: 'material-symbols:psychology',
      },
      {
        title: 'Couvert par les assurances',
        description: 'Membre RITMA. La plupart des assurances privées couvrent les séances. Aussi déductible d\'impôts.',
        span: 'single',
        icon: 'material-symbols:verified',
      },
      {
        title: 'À ton rythme',
        description: 'Pas de programme rigide. On avance ensemble, une séance à la fois. Tu décides quand, combien, et comment.',
        span: 'single',
        icon: 'material-symbols:self-improvement',
      },
    ],
  },
  {
    id: 'avancer',
    label: '03 — Avancer',
    headline: 'Ce que les gens découvrent en chemin.',
    subtext: 'La thérapie ne "fix" pas les gens. Elle leur donne les outils pour se comprendre et se choisir autrement.',
    cards: [
      {
        title: 'Communiquer sans blesser',
        description: 'Apprendre à dire ce qui compte vraiment — sans accusations, sans murs, sans fuir.',
        span: 'single',
        icon: 'material-symbols:forum',
      },
      {
        title: 'Comprendre tes patterns',
        description: 'Pourquoi tu réagis comme ça? D\'où viennent ces automatismes? Les neurosciences éclairent ce que l\'intuition pressent.',
        span: 'single',
        icon: 'material-symbols:neurology',
      },
      {
        title: 'Retrouver la connexion',
        description: 'Avec ton partenaire, avec toi-même. Le dialogue Imago transforme les dynamiques qui semblaient figées. Retrouver le chemin l\'un vers l\'autre, pas comme avant — mieux qu\'avant.',
        span: 'tall',
        icon: 'material-symbols:favorite',
      },
      {
        title: 'Faire des choix conscients',
        description: 'Au lieu de subir, tu choisis. Rester ou partir, pardonner ou poser tes limites — mais en pleine conscience.',
        span: 'large',
        icon: 'material-symbols:route',
      },
    ],
  },
]

export const journeyCTA = {
  headline: 'Tu as de la valeur.',
  subtext: 'Le premier pas, c\'est souvent le plus difficile. Mais tu n\'as pas à le faire seul·e.',
  label: 'Prendre soin de toi',
  ariaLabel: 'Prendre rendez-vous avec Chantal Massé',
}
