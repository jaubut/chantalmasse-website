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
    const gradient = GRADIENTS[currentState.value]
    const fromColor = lerpColor(gradient.from, gradient.to, stateProgress.value)
    const toColor = gradient.to
    return { from: fromColor, to: toColor }
  })

  const currentGradient = computed(() => {
    const { from, to } = gradientColors.value
    return `radial-gradient(ellipse at 50% 40%, ${to}, ${from})`
  })

  const objectScale = computed(() => 0.6 + progress.value * 0.6)
  const objectOpacity = computed(() => 0.3 + progress.value * 0.7)
  const objectBlur = computed(() => 40 - progress.value * 32)

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
