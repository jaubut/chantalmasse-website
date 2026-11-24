// Inline SVG for every icon the site names (prefix:name literals in components, pages and utils), so <Icon> renders
// at build time instead of fetching api.iconify.design in the browser. Re-run after using a new icon:
//   bun astro/scripts/gen-icons.ts
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getIconData, iconToSVG } from '@iconify/utils'
import { icons as material } from '@iconify-json/material-symbols'
import { icons as mdi } from '@iconify-json/mdi'

const sets = { 'material-symbols': material, mdi }
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? files(p) : /\.(vue|ts|astro)$/.test(f) ? [p] : []
})
const names = new Set<string>()
for (const f of ['utils', 'astro/src'].flatMap(files))
  for (const m of readFileSync(f, 'utf8').matchAll(/\b(material-symbols|mdi):([a-z0-9-]+)/g)) names.add(`${m[1]}:${m[2]}`)

const out: Record<string, string> = {}
for (const name of [...names].sort()) {
  const [prefix, icon] = name.split(':') as [keyof typeof sets, string]
  const data = getIconData(sets[prefix], icon)
  if (!data) throw new Error(`unknown icon ${name}`)
  const { attributes, body } = iconToSVG(data, { height: '1em' })
  out[name] = `<svg xmlns="http://www.w3.org/2000/svg" width="${attributes.width}" height="${attributes.height}" viewBox="${attributes.viewBox}" aria-hidden="true" role="img">${body}</svg>`
}
writeFileSync('astro/src/icons.json', JSON.stringify(out, null, 1) + '\n')
console.log(`${Object.keys(out).length} icons → astro/src/icons.json`)
