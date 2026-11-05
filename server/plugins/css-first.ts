// Start the app's JS only once the stylesheet has loaded, so chunk downloads stop competing with render-blocking CSS.
// An inline module script is deferred: it waits for the parser and for pending stylesheets, and still runs if the CSS fails.
// Nuxt has no option for this. If its tag format changes, nothing matches and the page keeps the default tags.
const HINTS = /<link rel="(?:modulepreload|prefetch)"[^>]*>/g
const ENTRY = /<script type="module" src="([^"]+)" crossorigin><\/script>/

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (html) => {
    const head = html.head.join('')
    const entry = head.match(ENTRY)?.[1]
    if (!entry) return
    const hints = JSON.stringify((head.match(HINTS) ?? []).join(''))
    const start = `<script type="module">document.head.insertAdjacentHTML('beforeend',${hints});import(${JSON.stringify(entry)})</script>`
    html.head = [head.replace(HINTS, '').replace(ENTRY, () => start)]
  })
})
