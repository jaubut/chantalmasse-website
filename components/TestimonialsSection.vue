<template>
  <section class="py-32 px-8 overflow-hidden bg-background">
    <div class="max-w-screen-xl mx-auto">

      <div class="text-center mb-16">
        <h2 class="font-headline text-5xl text-primary italic" data-animate>Témoignages</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

        <div
          v-for="(t, i) in testimonials"
          :key="t.name"
          class="bg-surface-container-low p-12 rounded-[2rem] editorial-shadow"
          :class="i === 1 || i === 2 ? 'lg:translate-y-8' : ''"
          data-animate
        >
          <p class="font-headline text-4xl text-primary-fixed-dim leading-none mb-6">"</p>
          <p class="text-on-surface text-lg leading-relaxed mb-8">
            {{ t.quote }}
          </p>
          <div>
            <p class="font-semibold text-primary">{{ t.name }}</p>
            <p class="text-sm text-on-surface-variant font-light">{{ t.context }}</p>
          </div>
        </div>

      </div>

      <div class="text-center mt-16" data-animate>
        <a
          href="https://search.google.com/local/writereview?placeid=ChIJf0hxfazRyUwRzgp46r7fzIQ"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-sm font-body"
        >
          <span class="text-base">★</span>
          Voir nos avis Google
        </a>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">

const testimonials = [
  {
    quote: "Les moments partagés avec Chantal ont été simplement bénissant. Elle m'a doucement guider dans mes réflexions et m'a aidé à travailler sur moi-même. J'ai pu, grâce à nos rencontres, apprendre enfin, à mieux me connaître, à m'aimer et enfin mettre mes limites. Douce, empathique, à l'écoute Chantal sait nous accompagné dans un respect des plus complet.",
    name: 'Alexandra',
    context: 'En thérapie individuelle',
  },
  {
    quote: "Nous avons beaucoup apprécié les séances de coaching de couple avec Chantal, car elle sait très bien établir une ambiance propice aux échanges. La communication se fait sans jugement et dans le respect. Son approche permet également de créer des ponts qui favorisent l'ouverture, la compréhension et l'acceptation. Nous recommandons sans réserve Chantal à tous ceux qui veulent réellement améliorer leur relation de couple.",
    name: 'Véronique & Dany',
    context: 'En thérapie de couple',
  },
  {
    quote: "Suite à certains problèmes dans ma vie, j'ai contacté Chantal pour m'aider à y voir plus clair. Tout de suite j'ai vu une différence. Je réussissais de plus en plus à analyser la situation par moi-même grâce aux outils qu'elle m'apportait. J'ai appris à prendre soin de moi, à accepter mes limites et à mieux accepter mes rechutes. Investir du temps et de l'énergie dans sa vie n'est pas toujours facile mais ça en vaut la peine. Avec Chantal, c'est simple et facile de parler. Elle va à notre rythme tout en nous amenant plus loin dans notre vie. Je vous la recommande à 100%.",
    name: 'Myriam',
    context: 'En thérapie individuelle',
  },
  {
    quote: "Chantal nous a aidé à avoir un but de couple tout en ayant des trucs pour les atteindre. Elle nous a appris à communiquer de façon efficace tout en restant dans le respect de l'autre et a se concentrer sur le NOUS…couple. Être focus sur le positif et ce que l'on aime de l'autre tout en restant fixé sur le nous. Elle nous guide dans nos moments plus difficile.",
    name: 'Suzy et Jocelyn',
    context: 'En coaching de couple',
  },
]
</script>
