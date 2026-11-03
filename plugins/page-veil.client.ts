// Page transition: a panel pulls down over the page, the route changes underneath, then it pulls back up.
// Styles: .cm-veil in main.css. Only for path changes, so in-page anchor links never trigger it.
// Reduced motion: same flow, plain short fade (CSS) with shorter waits.
const MOVE_MS = 500
const FADE_MS = 150

export default defineNuxtPlugin((nuxtApp) => {
  const html = document.documentElement
  const veil = document.createElement('div')
  veil.className = 'cm-veil'
  veil.setAttribute('aria-hidden', 'true')
  veil.innerHTML = '<span class="font-headline italic text-4xl sm:text-5xl text-secondary">Chantal Massé</span>'
  document.body.appendChild(veil)

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const ms = (): number => (reduce.matches ? FADE_MS : MOVE_MS)
  let covering = false
  let safety: ReturnType<typeof setTimeout> | undefined

  const lift = (): void => {
    if (!covering) return
    covering = false
    clearTimeout(safety)
    // Two frames so the new page's reveal observer has fired: its content is already shown under the panel.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      veil.classList.replace('is-in', 'is-out')
      setTimeout(() => {
        veil.classList.remove('is-out')
        html.classList.remove('cm-veiling')
      }, ms())
    }))
  }

  nuxtApp.$router.beforeEach((to, from) => {
    if (!nuxtApp.isHydrating && to.path !== from.path && !covering) {
      covering = true
      html.classList.add('cm-veiling')
      veil.classList.remove('is-out')
      veil.classList.add('is-in')
      safety = setTimeout(lift, 3000) // never leave the panel down if the page never finishes
      return new Promise<void>((resolve) => setTimeout(resolve, ms()))
    }
  })

  nuxtApp.hook('page:finish', lift)
  nuxtApp.$router.onError(lift)
})
