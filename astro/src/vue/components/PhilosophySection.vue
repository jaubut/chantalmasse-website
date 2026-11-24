<template>
  <section
    id="approche"
    class="py-32 px-8 bg-background"
    v-bind="tlsBlockAttrs(on, blockKey, 'rich_text')"
  >
    <div class="max-w-screen-xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

      <!-- Left: image -->
      <div class="relative" data-animate>
        <div class="aspect-square rounded-full overflow-hidden w-4/5 mx-auto">
          <img
            :src="philosophyImageSrc"
            :srcset="philosophyImageSrcset"
            :sizes="philosophyImageSrcset ? '(max-width: 1023px) 80vw, 480px' : undefined"
            :alt="philosophyImageAlt"
            class="w-full h-full object-cover object-[50%_22%]"
            v-bind="tlsBlockImageAttrs(on, docId, blockKey, 'media/0')"
          />
        </div>
        <!-- Floating quote -->
        <div class="absolute top-1/2 -right-4 lg:-right-8 -translate-y-1/2 bg-surface p-8 lg:p-10 rounded-3xl editorial-shadow max-w-[260px] lg:max-w-[280px] z-10">
          <p
            class="font-headline text-xl lg:text-2xl italic text-primary leading-snug lg:leading-8"
            v-bind="tlsBlockFieldAttrs(on, docId, blockKey, 'eyebrow')"
          >
            {{ cmsPhilosophy?.eyebrow || `"Pour retrouvez la connexion avec vous-même et l'autre."` }}
          </p>
        </div>
      </div>

      <!-- Right: text -->
      <div class="flex flex-col gap-8" data-animate>
        <h2
          class="font-headline text-5xl text-primary"
          v-bind="tlsBlockFieldAttrs(on, docId, blockKey, 'title')"
        >{{ cmsPhilosophy?.title || "L'amour conscient" }}</h2>

        <p
          class="font-light text-lg text-on-surface-variant leading-relaxed"
          v-bind="tlsBlockFieldAttrs(on, docId, blockKey, 'body')"
        >
          {{ cmsPhilosophy?.paragraphs?.[0] || "Mon approche repose sur la conviction que nos relations sont nos plus grands miroirs. En apprenant à regarder avec curiosité plutôt qu'avec jugement, nous transformons nos blessures passées en forces présentes." }}
        </p>

        <p class="font-light text-lg text-on-surface-variant leading-relaxed">
          {{ cmsPhilosophy?.paragraphs?.[1] || "À travers une présence empathique et des méthodes éprouvées, je vous accompagne vers une plus grande autonomie affective et une paix intérieure durable." }}
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

export interface CmsPhilosophyBlockData {
  docId?: string
  blockKey?: string
  eyebrow?: string
  title?: string
  paragraphs?: string[]
  image?: { src?: string; key?: string; alt?: string; srcset?: string }
}

const props = defineProps<{
  previewMode?: boolean
  cmsPhilosophy?: CmsPhilosophyBlockData
}>()

const on = computed(() => Boolean(props.previewMode))
const docId = computed(() => props.cmsPhilosophy?.docId || pageDocId('home'))
const blockKey = computed(() => props.cmsPhilosophy?.blockKey || 'approche')

const rawImgSrc = computed(() => {
  const raw = (props.cmsPhilosophy?.image?.src ?? props.cmsPhilosophy?.image?.key ?? '').trim()
  if (!raw) return undefined
  return (raw.startsWith('/') || /^https?:\/\//.test(raw)) ? raw : `/media/${raw.replace(/^\/+/, '')}`
})
const philosophyImageSrc = computed(() => rawImgSrc.value ?? '/images/chantal-portrait-44.jpg')
const philosophyImageSrcset = computed(() => {
  if (props.cmsPhilosophy?.image?.srcset) return props.cmsPhilosophy.image.srcset
  const src = rawImgSrc.value
  if (src && src.startsWith('/media/')) {
    const base = src.split('?')[0]!
    return [640, 960, 1280, 1920].map(w => `${base}?w=${w} ${w}w`).join(', ')
  }
  return undefined
})
const philosophyImageAlt = computed(
  () => props.cmsPhilosophy?.image?.alt?.trim() || "Chantal Massé, thérapeute en relation d'aide à Shefford",
)
</script>
