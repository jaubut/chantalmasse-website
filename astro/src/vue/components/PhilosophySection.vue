<template>
  <section
    id="approche"
    class="py-32 px-8 bg-background"
    v-bind="tlsBlockAttrs(on, 'approche', 'rich_text')"
  >
    <div class="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

      <!-- Left: image -->
      <div class="relative" data-animate>
        <div class="aspect-square rounded-full overflow-hidden w-4/5 mx-auto">
          <img
            src="https://images.unsplash.com/photo-1726766406089-0308c800b6b2?w=600&q=80&auto=format&fit=crop"
            alt="Approche thérapeutique"
            class="w-full h-full object-cover"
            v-bind="tlsBlockImageAttrs(on, docId, 'approche', 'media/0')"
          />
        </div>
        <!-- Floating quote -->
        <div class="absolute top-1/2 -right-4 lg:-right-8 -translate-y-1/2 bg-surface p-8 lg:p-10 rounded-3xl editorial-shadow max-w-[260px] lg:max-w-[280px] z-10">
          <p
            class="font-headline text-xl lg:text-2xl italic text-primary leading-snug lg:leading-8"
            v-bind="tlsBlockFieldAttrs(on, docId, 'approche', 'eyebrow')"
          >
            "Pour retrouvez la connexion avec vous-même et l'autre."
          </p>
        </div>
      </div>

      <!-- Right: text -->
      <div class="flex flex-col gap-8" data-animate>
        <h2
          class="font-headline text-5xl text-primary"
          v-bind="tlsBlockFieldAttrs(on, docId, 'approche', 'title')"
        >L'amour conscient</h2>

        <p
          class="font-light text-lg text-on-surface-variant leading-relaxed"
          v-bind="tlsBlockFieldAttrs(on, docId, 'approche', 'body')"
        >
          Mon approche repose sur la conviction que nos relations sont nos plus grands miroirs. En apprenant à regarder avec curiosité plutôt qu'avec jugement, nous transformons nos blessures passées en forces présentes.
        </p>

        <p class="font-light text-lg text-on-surface-variant leading-relaxed">
          À travers une présence empathique et des méthodes éprouvées, je vous accompagne vers une plus grande autonomie affective et une paix intérieure durable.
        </p>

        <div class="pt-4">
          <hr class="border-outline-variant/40 mb-4" />
          <p class="font-headline italic text-on-surface-variant">Chantal Massé, Thérapeute</p>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  pageDocId,
  tlsBlockAttrs,
  tlsBlockFieldAttrs,
  tlsBlockImageAttrs,
} from '../../lib/tls-edit-attrs'

const props = defineProps<{ previewMode?: boolean }>()
const on = computed(() => Boolean(props.previewMode))
const docId = pageDocId('home')
</script>
