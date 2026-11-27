<template>
  <section
    id="booking"
    class="py-32 px-8 bg-background"
    v-bind="tlsBlockAttrs(pageOn, blockKey, 'cta')"
  >
    <div class="max-w-screen-xl mx-auto">
      <div class="bg-surface-container-low rounded-[3rem] p-8 lg:p-24 relative overflow-hidden">

        <!-- Decorative icon -->
        <Icon icon="material-symbols:eco" class="absolute top-0 right-0 text-primary opacity-10 select-none pointer-events-none" style="width: 20rem; height: 20rem; line-height: 1; transform: translate(20%, -10%);" />

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

          <!-- Left -->
          <div data-animate>
            <h2
              class="font-headline text-5xl italic text-primary mb-6"
              v-bind="tlsBlockFieldAttrs(pageOn, docId, blockKey, 'note')"
            >
              {{ cmsBooking?.note || 'Prêt à entamer cette démarche?' }}
            </h2>
            <p class="text-on-surface-variant font-light text-lg mb-10">
              Consultations disponibles en personne à Shefford ou en vidéoconférence.
            </p>

            <ul class="space-y-6 mb-12">
              <li class="flex items-start gap-4">
                <Icon icon="material-symbols:location-on" class="text-primary mt-0.5" />
                <div>
                  <p class="font-semibold text-on-surface">Bureau Shefford</p>
                  <p class="text-on-surface-variant font-light">Région de la Haute-Yamaska</p>
                </div>
              </li>
              <li class="flex items-start gap-4">
                <Icon icon="material-symbols:verified" class="text-primary mt-0.5" />
                <div>
                  <p class="font-semibold text-on-surface">Membre RITMA</p>
                  <p class="text-on-surface-variant font-light">Reçus pour fins d'assurances disponibles</p>
                </div>
              </li>
            </ul>

            <button
              class="inline-block bg-primary text-on-primary px-12 py-6 rounded-2xl font-bold text-xl liquid-fill [--fill:var(--color-primary-container)]"
              data-booking-open
              v-bind="tlsBlockFieldAttrs(pageOn, docId, blockKey, 'label')"
            >
              {{ cmsBooking?.label || 'Réserver une séance' }}
            </button>
          </div>

          <!-- Right: schedule card -->
          <div
            class="bg-surface p-12 rounded-[2rem] editorial-shadow"
            data-animate
            v-bind="tlsSettingsFieldAttrs(on, settingsId, 'hours')"
          >
            <h4 class="font-headline text-2xl italic text-primary mb-8">Horaires habituels</h4>
            <div class="space-y-0">
              <div
                v-for="(row, idx) in resolvedHours"
                :key="`${row.label}-${idx}`"
                class="flex justify-between py-4"
                :class="idx < resolvedHours.length - 1 ? 'border-b border-outline-variant/20' : ''"
              >
                <span :class="isClosedRow(row.value) ? 'text-[#676e6a] font-medium' : 'text-on-surface font-medium'">{{ row.label }}</span>
                <span :class="isClosedRow(row.value) ? 'text-[#676e6a] font-light' : 'text-on-surface-variant font-light'">{{ row.value }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../Icon.vue'
import {
  pageDocId,
  settingsDocId,
  tlsBlockAttrs,
  tlsBlockFieldAttrs,
  tlsSettingsFieldAttrs,
} from '../../lib/tls-edit-attrs'

export interface CmsBookingBlockData {
  docId?: string
  blockKey?: string
  note?: string
  label?: string
}

export interface CmsBookingSettingsData {
  id?: string
  hours?: Array<{ label: string; value: string }>
}

const props = withDefaults(
  defineProps<{
    previewMode?: boolean
    pagePreviewMode?: boolean
    cmsBooking?: CmsBookingBlockData
    cmsSettings?: CmsBookingSettingsData
  }>(),
  { pagePreviewMode: undefined },
)

const on = computed(() => Boolean(props.previewMode))
const pageOn = computed(() => Boolean(props.pagePreviewMode ?? props.previewMode))
const docId = computed(() => props.cmsBooking?.docId || pageDocId('home'))
const blockKey = computed(() => props.cmsBooking?.blockKey || 'booking')
const settingsId = computed(() => props.cmsSettings?.id || settingsDocId())

const DEFAULT_HOURS = [
  { label: 'Lundi', value: '10:30 — 18:30' },
  { label: 'Mardi', value: '09:00 — 18:30' },
  { label: 'Mercredi — Jeudi', value: '09:00 — 17:00' },
  { label: 'Vendredi — Dimanche', value: 'Fermé' },
]

const resolvedHours = computed(() => {
  const custom = props.cmsSettings?.hours?.filter(h => h && h.label?.trim() && h.value?.trim())
  return custom && custom.length > 0 ? custom : DEFAULT_HOURS
})

const isClosedRow = (value: string): boolean => /^ferm[ée]/i.test(value.trim())
</script>
