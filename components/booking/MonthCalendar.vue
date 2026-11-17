<template>
  <div class="px-2">
    <!-- First availability, from the months already loaded -->
    <div v-if="firstAvailable !== null" class="mb-8" aria-live="polite">
      <button
        v-if="firstAvailable"
        type="button"
        class="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-primary/20 bg-primary-fixed/60 px-5 py-4 text-left transition-colors duration-200 hover:border-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        @click="emit('pick', firstAvailable.date, firstAvailable.slots, firstAvailable.slots[0])"
      >
        <span class="font-body text-sm text-on-surface">
          <span class="font-semibold text-primary">Première disponibilité&nbsp;:</span>
          {{ formatSlotStart(firstAvailable.slots[0].isoStart) }}
        </span>
        <span class="font-body text-sm font-semibold text-primary underline underline-offset-4 shrink-0">
          Choisir ce moment
        </span>
      </button>
      <div v-else class="h-14 rounded-xl bg-surface-container motion-safe:animate-pulse" />
    </div>

    <!-- Month navigation -->
    <div class="flex items-center justify-between mb-8">
      <button
        class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 font-body text-on-surface"
        :class="isPrevDisabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-surface-container'"
        :disabled="isPrevDisabled"
        aria-label="Mois précédent"
        @click="prevMonth"
      >
        <Icon icon="material-symbols:chevron-left" class="text-xl" />
      </button>

      <h3 class="font-headline text-2xl italic text-primary capitalize">
        {{ monthLabel }}
      </h3>

      <button
        class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 font-body text-on-surface"
        :class="isNextDisabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-surface-container'"
        :disabled="isNextDisabled"
        aria-label="Mois suivant"
        @click="nextMonth"
      >
        <Icon icon="material-symbols:chevron-right" class="text-xl" />
      </button>
    </div>

    <!-- Day headers -->
    <div class="grid grid-cols-7 mb-2">
      <div
        v-for="day in dayHeaders"
        :key="day"
        class="text-center text-xs font-body font-semibold text-on-surface-variant py-2 uppercase tracking-widest"
      >
        {{ day }}
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7 gap-1">
      <template v-for="(cell, idx) in calendarCells" :key="idx">
        <!-- Out of month padding -->
        <div v-if="!cell.date" class="h-12" />

        <!-- Day cell -->
        <button
          v-else
          class="h-12 w-full rounded-xl text-sm font-body font-medium transition-all duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary relative"
          :class="isLoading ? 'bg-surface-container-high/50' : dayClasses(cell)"
          :disabled="!cell.isAvailable || cell.isPast || cell.isBeyondWindow"
          :aria-label="cell.date ? format(cell.date, 'd MMMM yyyy', { locale: fr }) : ''"
          @click="cell.isAvailable && !cell.isPast && !cell.isBeyondWindow && selectDate(cell.date!)"
        >
          <!-- Skeleton pulse while loading -->
          <span v-if="isLoading" class="absolute inset-1 rounded-lg animate-pulse bg-surface-container" />
          <span v-else>{{ cell.dayNumber }}</span>
        </button>
      </template>
    </div>

    <div v-if="loadError" role="alert" class="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-center font-body text-sm text-red-700">
      Impossible de charger les disponibilités.
      <button type="button" class="ml-1 min-h-11 font-semibold underline underline-offset-4" @click="fetchAvailability(currentViewMonth)">Réessayer</button>
      <span class="block mt-1">Ou écris à <a href="mailto:chantal.gmasse@gmail.com" class="underline">chantal.gmasse@gmail.com</a>.</span>
    </div>

    <!-- Legend -->
    <div class="flex items-center justify-center gap-6 mt-6 font-body text-xs text-on-surface-variant">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-primary-fixed border border-primary/30" />
        Disponible
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-surface-container border border-outline-variant/30" />
        Indisponible
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-primary" />
        Sélectionné
      </div>
    </div>

    <p class="text-center font-body text-xs text-on-surface-variant mt-3 opacity-70">
      Les disponibilités sont affichées en heure de l'Est (ET)
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { BookingService } from './ServiceSelector.vue'
import { formatSlotStart, type TimeSlot } from '~/utils/bookingHelpers'

interface CalendarCell {
  date: Date | null
  dayNumber: number | null
  isPast: boolean
  isBeyondWindow: boolean
  isAvailable: boolean
  isToday: boolean
}

const props = defineProps<{
  service: BookingService
  selectedDate: Date | null
}>()

const emit = defineEmits<{
  select: [date: Date, slots: TimeSlot[]]
  pick: [date: Date, slots: TimeSlot[], slot: TimeSlot]
}>()

interface MonthAvailability {
  availableDates: string[]
  slotsByDate: Record<string, TimeSlot[]>
}

const runtimeConfig = useRuntimeConfig()
const publicAdvanceDays = computed(() =>
  parseInt(runtimeConfig.public.bookingAdvanceDays as string, 10) || 60,
)

const today = new Date()
const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
const currentViewMonth = ref(thisMonth)
const loadError = ref(false)
const prefetchFailed = ref(false)
const availabilityCache = ref(new Map<string, MonthAvailability>())
const inflight = new Map<string, Promise<void>>()
const isLoading = computed(() => !loadError.value && !availabilityCache.value.has(cacheKey(currentViewMonth.value)))

const dayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const monthLabel = computed(() =>
  format(currentViewMonth.value, 'MMMM yyyy', { locale: fr }),
)

const isPrevDisabled = computed(() => !isBefore(thisMonth, currentViewMonth.value))

const maxMonth = computed(() => new Date(today.getFullYear(), today.getMonth() + Math.ceil(publicAdvanceDays.value / 28), 1))
const isNextDisabled = computed(() => !isBefore(currentViewMonth.value, maxMonth.value))

const maxDate = computed(() => addDays(today, publicAdvanceDays.value))

const availableDatesThisMonth = computed<string[]>(() =>
  availabilityCache.value.get(cacheKey(currentViewMonth.value))?.availableDates || [],
)

// undefined = still loading, null = nothing this month or next.
const firstAvailable = computed<{ date: Date; slots: TimeSlot[] } | null | undefined>(() => {
  for (const month of [thisMonth, addMonths(thisMonth, 1)]) {
    if (isAfter(month, maxMonth.value)) break
    const data = availabilityCache.value.get(cacheKey(month))
    if (!data) return loadError.value || prefetchFailed.value ? null : undefined
    const day = data.availableDates.find(d => data.slotsByDate[d]?.length)
    if (day) {
      const [y, m, d] = day.split('-').map(Number)
      return { date: new Date(y, m - 1, d), slots: data.slotsByDate[day] }
    }
  }
  return null
})

function cacheKey(date: Date): string {
  return `${format(date, 'yyyy-MM')}:${props.service.id}`
}

const calendarCells = computed<CalendarCell[]>(() => {
  const monthStart = startOfMonth(currentViewMonth.value)
  const monthEnd = endOfMonth(currentViewMonth.value)

  // Start grid on Monday
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const cells: CalendarCell[] = []
  let current = gridStart

  while (!isAfter(current, gridEnd)) {
    if (!isSameMonth(current, currentViewMonth.value)) {
      cells.push({ date: null, dayNumber: null, isPast: false, isBeyondWindow: false, isAvailable: false, isToday: false })
    } else {
      const dateKey = format(current, 'yyyy-MM-dd')
      const isPast = isBefore(startOfDay(current), startOfDay(today))
      const isBeyondWindow = isAfter(current, maxDate.value)
      const isAvailable = !isPast && !isBeyondWindow && availableDatesThisMonth.value.includes(dateKey)

      cells.push({
        date: new Date(current),
        dayNumber: current.getDate(),
        isPast,
        isBeyondWindow,
        isAvailable,
        isToday: isSameDay(current, today),
      })
    }
    current = addDays(current, 1)
  }

  return cells
})

function dayClasses(cell: CalendarCell): string {
  if (!cell.date) return ''

  const isSelected = props.selectedDate && isSameDay(cell.date, props.selectedDate)

  if (isSelected) return 'bg-primary text-on-primary font-semibold'
  if (cell.isToday && !cell.isPast && !cell.isBeyondWindow)
    return cell.isAvailable
      ? 'ring-2 ring-primary font-bold bg-primary-fixed hover:bg-primary hover:text-on-primary cursor-pointer'
      : 'ring-2 ring-primary/30 font-bold text-on-surface/30 cursor-not-allowed'
  if (cell.isPast || cell.isBeyondWindow) return 'text-on-surface/20 cursor-not-allowed'
  if (cell.isAvailable) return 'bg-primary-fixed hover:bg-primary hover:text-on-primary cursor-pointer'
  return 'text-on-surface/30 cursor-not-allowed'
}

function selectDate(date: Date) {
  emit('select', date, availabilityCache.value.get(cacheKey(date))?.slotsByDate[format(date, 'yyyy-MM-dd')] || [])
}

// One request per month and service, shared by the visible load and the prefetch.
function loadMonth(monthDate: Date): Promise<void> {
  const key = cacheKey(monthDate)
  if (availabilityCache.value.has(key)) return Promise.resolve()
  let pending = inflight.get(key)
  if (!pending) {
    pending = $fetch<MonthAvailability>('/api/booking/availability', {
      params: { month: format(monthDate, 'yyyy-MM'), service: props.service.id },
    })
      .then((data) => {
        const newCache = new Map(availabilityCache.value)
        newCache.set(key, { availableDates: data.availableDates, slotsByDate: data.slotsByDate })
        availabilityCache.value = newCache
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }
  return pending
}

// Visible month first; the next one loads in the background so paging is instant.
async function fetchAvailability(monthDate: Date) {
  loadError.value = false
  try {
    await loadMonth(monthDate)
  } catch (err) {
    console.error('[MonthCalendar] Failed to fetch availability:', err)
    loadError.value = true
    return
  }
  const next = addMonths(monthDate, 1)
  if (!isAfter(next, maxMonth.value)) loadMonth(next).catch(() => { prefetchFailed.value = true })
}

function prevMonth() {
  if (isPrevDisabled.value) return
  currentViewMonth.value = subMonths(currentViewMonth.value, 1)
}

function nextMonth() {
  if (isNextDisabled.value) return
  currentViewMonth.value = addMonths(currentViewMonth.value, 1)
}

watch(currentViewMonth, (val) => {
  fetchAvailability(val)
})

watch(() => props.service.id, () => {
  availabilityCache.value = new Map()
  prefetchFailed.value = false
  fetchAvailability(currentViewMonth.value)
})

onMounted(() => {
  fetchAvailability(currentViewMonth.value)
})
</script>
