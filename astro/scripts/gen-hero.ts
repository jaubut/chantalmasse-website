// Resized WebP copies of public/images/chantal-hero.jpg for the widths the hero <img> srcsets declare (HeroSection,
// PrendreRendezVousPage). The Nuxt build served the 2570 px, 913 KB original for every width; it was the LCP image.
// The original stays as src and og:image. Re-run after replacing the photo: bun astro/scripts/gen-hero.ts
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const WIDTHS = [615, 690, 877, 1230, 1380, 1754]
mkdirSync('public/images/hero', { recursive: true })
for (const w of WIDTHS) {
  const out = `public/images/hero/chantal-hero-${w}.webp`
  const info = await sharp('public/images/chantal-hero.jpg').resize({ width: w }).webp({ quality: 78 }).toFile(out)
  console.log(`${out} ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`)
}
