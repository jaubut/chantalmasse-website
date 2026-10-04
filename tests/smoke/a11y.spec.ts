import AxeBuilder from '@axe-core/playwright'
import { expect, test, waitForHydration } from './fixtures'

// Gate only on serious/critical WCAG A/AA violations; minor/moderate ones are
// printed for information but don't block a dependency update.
//
// Reduced motion: the site then renders every [data-animate] block in its final
// state. Otherwise axe samples reveal fades mid-transition (blended colours =
// false contrast failures) and skips still-hidden blocks entirely.
//
// Tolerated pre-existing serious rules (none today); any other fails.
const KNOWN_SERIOUS = new Set<string>()
test('home page has no serious or critical accessibility violations', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await waitForHydration(page)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const summary = results.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length}) ${v.help}`)
  await testInfo.attach('axe-violations', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' })
  if (summary.length) console.log(`axe (all impacts):\n  ${summary.join('\n  ')}`)

  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .filter((v) => !KNOWN_SERIOUS.has(v.id))
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))
  expect(blocking).toEqual([])
})
