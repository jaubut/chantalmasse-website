export type EmotionalState = 'crisis' | 'awareness' | 'process' | 'relief'

interface GradientStop {
  from: string
  to: string
}

const GRADIENTS: Record<EmotionalState, GradientStop> = {
  crisis:    { from: '#1a0a0a', to: '#2d1520' },
  awareness: { from: '#2d1520', to: '#3a2a1a' },
  process:   { from: '#3a2a1a', to: '#2a3a2d' },
  relief:    { from: '#2a3a2d', to: '#fef8f3' },
}

// Continuous color ramp — evenly spaced stops across the full 0→1 scroll progress
// This prevents hard jumps between states and creates one smooth gradient transition
const COLOR_RAMP = [
  { at: 0.00, color: '#30273a' },  // tertiary — closed, heavy, inward
  { at: 0.12, color: '#3a2a3d' },  // deepening into warm purple
  { at: 0.30, color: '#3d2d30' },  // shifting from purple into earthy brown
  { at: 0.48, color: '#3a3528' },  // amber warmth emerging
  { at: 0.62, color: '#2f4035' },  // green growth begins
  { at: 0.78, color: '#5a7a6a' },  // sage — the soul opening
  { at: 0.90, color: '#c5d5cc' },  // soft light, almost there
  { at: 1.00, color: '#f2ede8' },  // warm cream — peace, matches site
]

const STATES: EmotionalState[] = ['crisis', 'awareness', 'process', 'relief']

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const ca = parse(a)
  const cb = parse(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const b_ = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b_.toString(16).padStart(2, '0')}`
}

/** Interpolate along the full color ramp at a given progress (0→1) */
function sampleRamp(p: number): string {
  const clamped = Math.max(0, Math.min(1, p))
  for (let i = 0; i < COLOR_RAMP.length - 1; i++) {
    const curr = COLOR_RAMP[i]
    const next = COLOR_RAMP[i + 1]
    if (clamped >= curr.at && clamped <= next.at) {
      const t = (clamped - curr.at) / (next.at - curr.at)
      return lerpColor(curr.color, next.color, t)
    }
  }
  return COLOR_RAMP[COLOR_RAMP.length - 1].color
}

export function useScrollJourney() {
  const progress = ref(0)
  const containerRef = ref<HTMLElement | null>(null)

  const currentState = computed<EmotionalState>(() => {
    if (progress.value < 0.25) return 'crisis'
    if (progress.value < 0.5) return 'awareness'
    if (progress.value < 0.75) return 'process'
    return 'relief'
  })

  const stateProgress = computed(() => {
    const idx = STATES.indexOf(currentState.value)
    const stateStart = idx * 0.25
    return Math.min(1, (progress.value - stateStart) / 0.25)
  })

  const gradientColors = computed(() => {
    // Sample two points on the ramp — slightly offset for a radial spread
    const from = sampleRamp(progress.value)
    const to = sampleRamp(Math.min(1, progress.value + 0.08))
    return { from, to }
  })

  const currentGradient = computed(() => {
    const { from, to } = gradientColors.value
    return `radial-gradient(ellipse at 50% 40%, ${to}, ${from})`
  })

  // Soul opening: starts small and tight, grows large and clear
  const objectScale = computed(() => 0.4 + progress.value * 1.2)   // 0.4 → 1.6
  const objectOpacity = computed(() => 0.2 + progress.value * 0.8)  // 0.2 → 1.0
  const objectBlur = computed(() => 50 - progress.value * 44)       // 50px → 6px

  let scrollCleanup: (() => void) | null = null

  onMounted(async () => {
    const el = containerRef.value
    if (!el) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      progress.value = 1
      return
    }

    const { gsap } = await import('gsap')
    const { ScrollTrigger } = await import('gsap/ScrollTrigger')
    gsap.registerPlugin(ScrollTrigger)

    // Track scroll progress across the full page height (normal scrolling)
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.3,
      onUpdate: (self) => {
        progress.value = self.progress
      },
    })

    scrollCleanup = () => trigger.kill()
  })

  onUnmounted(() => {
    scrollCleanup?.()
  })

  return {
    progress,
    containerRef,
    currentState,
    stateProgress,
    currentGradient,
    objectScale,
    objectOpacity,
    objectBlur,
  }
}
