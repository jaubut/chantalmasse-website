<template>
  <div class="px-2">
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
          class="h-12 w-full rounded-xl text-sm font-body font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary relative"
          :class="dayClasses(cell)"
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
  select: [date: Date]
}>()

const PUBLIC_ADVANCE_DAYS = 60

const today = new Date()
const currentViewMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const isLoading = ref(false)
const availabilityCache = ref(new Map<string, string[]>())

const dayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const monthLabel = computed(() =>
  format(currentViewMonth.value, 'MMMM yyyy', { locale: fr }),
)

const isPrevDisabled = computed(() => {
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  return !isBefore(thisMonth, currentViewMonth.value)
})

const isNextDisabled = computed(() => {
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + Math.ceil(PUBLIC_ADVANCE_DAYS / 28), 1)
  return !isBefore(currentViewMonth.value, maxMonth)
})

const maxDate = computed(() => addDays(today, PUBLIC_ADVANCE_DAYS))

const availableDatesThisMonth = computed<string[]>(() => {
  const key = cacheKey(currentViewMonth.value)
  return availabilityCache.value.get(key) || []
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
  emit('select', date)
}

async function fetchAvailability(monthDate: Date) {
  const key = cacheKey(monthDate)
  if (availabilityCache.value.has(key)) return

  isLoading.value = true
  try {
    const monthStr = format(monthDate, 'yyyy-MM')
    const data = await $fetch<{ availableDates: string[] }>('/api/booking/availability', {
      params: { month: monthStr, service: props.service.id },
    })
    // Update cache reactively
    const newCache = new Map(availabilityCache.value)
    newCache.set(key, data.availableDates)
    availabilityCache.value = newCache
  } catch (err) {
    console.error('[MonthCalendar] Failed to fetch availability:', err)
  } finally {
    isLoading.value = false
  }
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
  fetchAvailability(currentViewMonth.value)
})

onMounted(() => {
  fetchAvailability(currentViewMonth.value)
})
</script>
