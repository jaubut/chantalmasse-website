// Calm wipe between pages (adapted from BYQ gem curtain-image-reveal-01). Styles: .cm-veil in main.css.
// Only for path changes, so in-page anchor links never trigger it; skipped under reduced motion.
const IN_MS = 300
const OUT_MS = 400

export default defineNuxtPlugin((nuxtApp) => {
  const veil = document.createElement('div')
  veil.className = 'cm-veil'
  veil.setAttribute('aria-hidden', 'true')
  veil.innerHTML = '<span class="font-headline italic text-3xl text-secondary">Chantal Massé</span>'
  document.body.appendChild(veil)

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  let covering = false
  let safety: ReturnType<typeof setTimeout> | undefined

  const lift = (): void => {
    if (!covering) return
    covering = false
    clearTimeout(safety)
    veil.classList.replace('is-in', 'is-out')
    setTimeout(() => veil.classList.remove('is-out'), OUT_MS)
  }

  nuxtApp.$router.beforeEach((to, from) => {
    if (!nuxtApp.isHydrating && to.path !== from.path && !reduce.matches && !covering) {
      covering = true
      veil.classList.remove('is-out')
      veil.classList.add('is-in')
      safety = setTimeout(lift, 2500) // never leave the veil up if the page never finishes
      return new Promise<void>((resolve) => setTimeout(resolve, IN_MS))
    }
  })

  nuxtApp.hook('page:finish', lift)
  nuxtApp.$router.onError(lift)
})
