# ORCHESTRATOR.md

## Architecture Overview

Single-page marketing website for **Chantal Massé**, a French-language therapist based in Shefford, Québec.

**Stack**
- Nuxt 3 (SSR, `compat date: 2024-11-01`) — deployed to Vercel via `nitro preset: 'vercel'`
- Vue 3 (Composition API, `<script setup>`)
- Tailwind CSS via `@nuxtjs/tailwindcss`
- Google Fonts via `@nuxtjs/google-fonts`
- Material Symbols (icon font, loaded from Google CDN + `@iconify-json/material-symbols` for dev)

**Entry points**
```
app.vue           — root shell: <TheNav /> + <NuxtPage /> + <TheFooter />
pages/index.vue   — single page, composes all sections in order + calls useScrollAnimation()
```

**Deployment**
- `vercel.json` sets `buildCommand: npm run build`, `outputDirectory: .output/public`, `framework: nuxtjs`
- Language: `fr` (set in `nuxt.config.ts` → `app.head.htmlAttrs`)

---

## Module Boundaries & Ownership

### Layout Shell (`app.vue`)
Wraps every page. Only owns global chrome: nav + footer.

### Page (`pages/index.vue`)
Owns section order and initialises scroll animation. No local state.

### Components (`components/`)

| File | Section ID | Purpose |
|---|---|---|
| `TheNav.vue` | — | Sticky nav, scroll-shadow, mobile hamburger drawer |
| `HeroSection.vue` | — | Full-height intro, headline, two CTAs, portrait image |
| `ServicesSection.vue` | `#services` | Two service cards: Thérapie Individuelle + Coaching de Couple |
| `PhilosophySection.vue` | `#approche` | Left image + floating quote, right prose |
| `MethodsSection.vue` | — | Three methodology cards: ANDC, Imago, Neurosciences |
| `TestimonialsSection.vue` | — | Three testimonial cards (staggered vertical offset on lg) |
| `NewsletterSection.vue` | — | Email subscribe form + two blog preview cards |
| `BookingSection.vue` | `#booking` | Contact CTA + location/accreditation info + schedule card |
| `TheFooter.vue` | — | Logo, legal links (stubs), copyright |

### Composable (`composables/useScrollAnimation.ts`)
`IntersectionObserver` that adds `.visible` to every `[data-animate]` element at 10% threshold. Called once in `pages/index.vue`. Observer is disconnected on `onUnmounted`.

### Styles (`assets/css/main.css`)
- Tailwind base/components/utilities
- `body` default font + background
- `html { scroll-behavior: smooth }`
- `.editorial-shadow` utility (subtle box-shadow)
- `[data-animate]` / `[data-animate].visible` — scroll-reveal keyframe (opacity + translateY)
- Material Symbols font-variation-settings global reset

### Design Tokens (`tailwind.config.ts`)
All colors follow a **Material Design 3** role naming scheme:

| Role group | Key tokens |
|---|---|
| Primary | `primary` `#173028`, `primary-container`, `primary-fixed`, `on-primary`, `on-primary-container` |
| Secondary | `secondary` `#515d85`, `secondary-container`, `secondary-fixed`, `on-secondary`, `on-secondary-container` |
| Tertiary | `tertiary` `#30273a`, `tertiary-container`, `on-tertiary`, `on-tertiary-container` |
| Surface | `surface`, `surface-container-{lowest/low/DEFAULT/high/highest}`, `background` |
| Content | `on-surface`, `on-surface-variant`, `outline`, `outline-variant` |

Typography:
- `font-headline` → Newsreader (serif, italic variants used heavily)
- `font-body` → Manrope (sans-serif, default body font)

Border-radius scale is intentionally tighter than Tailwind defaults (sm `2px`, lg `4px`, xl `8px`, full `12px`).

---

## Conventions & Patterns

- **Scroll reveal**: add `data-animate` to any element to opt into the fade-up animation. No JS needed at the component level — `useScrollAnimation()` handles it globally.
- **Anchor navigation**: nav links use `href="#section-id"`. Active sections that need to be linkable must set `id="..."` on the `<section>` tag.
- **Icon usage**: Material Symbols icon font (ligature-based). Icon weight/fill globally set to `wght 300, FILL 0` via `main.css`. Individual icons can override with inline `style="font-variation-settings: ..."` (see star icons in TestimonialsSection).
- **Responsive layout**: mobile-first. Breakpoint in use is `md` (hamburger/desktop nav split) and `lg` (two-column grid layouts).
- **Color on dark backgrounds**: when a section uses `bg-primary` or `bg-tertiary`, text switches to `text-on-primary` / `text-on-tertiary` and supporting colors shift to their container equivalents.
- **No TypeScript in components**: all `.vue` files use plain JS inside `<script setup>`. TypeScript is used in `.ts` files only (`nuxt.config.ts`, `tailwind.config.ts`, `useScrollAnimation.ts`).
- **No state management library**: all state is local `ref()` inside each component.

---

## Known Fragile Areas

- **Hero image & blog images are Unsplash URLs** — not local assets. They will break if Unsplash changes URLs or rate-limits. Real production images should be placed in `public/images/` (a `.gitkeep` exists).
- **Newsletter form does nothing** — `@submit.prevent` with no handler. Needs backend integration (e.g. Mailchimp, Kit, or a Nuxt server route).
- **Booking CTA is a self-anchor** (`href="#booking"`) — there is no actual calendar or booking integration yet.
- **Footer links are stubs** (`href="#"`) — Mentions Légales, Confidentialité, and FR/EN toggle are not implemented.
- **Blog section is static** — the two cards in `NewsletterSection.vue` are hardcoded. There is no CMS, no `pages/blog/` route, and no content collection.
- **TheNav scroll listener has no cleanup** — `window.addEventListener` in `onMounted` is never removed on unmount. Low risk for a single-page app but worth noting.
- **`public/images/` is empty** — only `.gitkeep` present. Images are expected to live here once sourced.

---

## Decisions Made

- **Nuxt SSR over SPA** — `ssr: true` ensures SEO is handled server-side, important for a therapist's discoverability.
- **Vercel + Nitro preset** — zero-config deployment; `vercel.json` is minimal by design.
- **Material Design 3 color roles** — provides a systematic, accessible palette rather than ad-hoc hex values. Allows future dark mode via role swapping.
- **Newsreader italic for headlines** — editorial, warm aesthetic aligned with the therapeutic brand. Manrope provides readable, neutral body copy.
- **`useScrollAnimation` as a composable** — keeps animation logic out of individual components and ensures a single observer instance per page.
- **French as primary language** — `lang="fr"` in HTML head; all copy is French. An EN toggle exists in the footer but is not implemented.
- **No router guards or layouts directory** — single page, no need for multiple layouts or route protection.

---

## Current State / Active Work

- **Branch**: `claude/add-interactive-session-ugd3U`
- **Two commits on `master`**:
  1. `8f73167` — initial site build (all sections, composable, config)
  2. `c37c338` — `.gitignore` cleanup, removed generated files from tracking

**What exists**: Full one-page marketing site with nav, hero, services, philosophy, methods, testimonials, newsletter preview, booking section, and footer. Visually complete.

**What is missing / next steps**:
- Real photography (replace Unsplash placeholders with `public/images/`)
- Booking system integration (Calendly embed, or custom form → email)
- Newsletter backend (Mailchimp / Kit API or Nuxt server route)
- Blog: create `pages/blog/` + content collections or CMS
- Legal pages: Mentions Légales, Politique de confidentialité
- EN language toggle / i18n (`@nuxtjs/i18n`)
- Cleanup: remove scroll listener memory leak in `TheNav.vue`
- SEO: add `useSeoMeta()` or `<Head>` with title, description, OG tags
