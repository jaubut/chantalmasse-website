# Chantal Massé — Website

## Project

Therapy & coaching website for Chantal Massé (Shefford, QC). French-first, single-page marketing site with booking system, blog, and newsletter.

## Stack

- Nuxt 4 + Vue 3 (Composition API, `<script setup>`)
- Tailwind CSS (Material Design 3 color roles)
- Google Fonts: Newsreader (serif headlines) + Manrope (sans body)
- GSAP (scroll animations) — preferred over CSS-only for scroll-linked timelines
- Vercel deployment (SSR via Nitro)
- Google Calendar API (booking), Resend (email), Brevo (newsletter)

## Architecture

See `ORCHESTRATOR.md` for full component map, design tokens, and conventions.

---

## Development Workflow — Mandatory for Every New Page/Feature

**Never jump to code.** Every new page, section, or significant feature MUST go through this pipeline before implementation. This is non-negotiable.

### Phase 1 — Strategy

**Skill:** `/web-strategy` (or extract from existing project brief)

Answer these before anything else:
1. **Who** is this for? (persona, emotional state, what they know when they arrive)
2. **What** is the one central action we want them to take?
3. **What** do they need to understand before they'll do it?
4. **How** does this page/feature fit the overall site conversion flow?

Output: Strategic context added to the feature's vault note or project file.

Skip condition: Only skip if the feature is purely technical (bug fix, performance, refactor) with no user-facing impact.

### Phase 2 — Design Direction

**Skills:** `/mood-board` + `/feature-map` (run in parallel)

- `/mood-board` → Visual direction: which 2026 trends apply, color palette extension, typography choices, feel word, anti-patterns
- `/feature-map` → Functional requirements: what this page/feature must DO at each funnel stage, Stitch-ready descriptions

Output: Design Direction Document + Feature Funnel Document in the vault.

Skip condition: Only skip if the feature is within an already-designed section (e.g., adding a field to the existing booking form).

### Phase 3 — UI Design

**Skill:** `/stitch-prep` or `/stitch-design`

- Generate high-fidelity screens using the Design Direction + Feature Map as input
- Validate visual hierarchy, spacing, typography before writing code
- Capture design decisions that Stitch produces

Output: Stitch screens + design notes.

Skip condition: Skip for backend-only features (API routes, email templates, data migrations).

### Phase 4 — Technical Plan

**Mode:** Plan Mode (`/plan`)

- Now and only now: plan the implementation
- Reference specific files from `ORCHESTRATOR.md`
- Identify components to create/modify
- Define the composable/utility needs
- Include mobile adaptation + `prefers-reduced-motion`
- Include performance budget (Lighthouse mobile > 85)
- Include verification steps

Output: Plan file in `.claude/plans/`.

### Phase 5 — Build

**Skill:** `/frontend-design` (5-step premium build sequence)

Execute the plan using the 5-step sequential build system. Never skip steps:

1. **Foundation** — data file + bare components + page (content first, zero styling)
2. **Design System** — apply colors, textures, typography from mood-board
3. **Layout & Hero** — asymmetric grids, whitespace, premium hero composition
4. **Interactions** — scroll reveals, hover states, cursor effects (GSAP)
5. **Motion** — parallax, animated counters, final cinematic polish

Each step verified before moving to the next. Follow existing conventions from `ORCHESTRATOR.md`.

### Phase 6 — Review

**Skill:** `/review`

Run before any deployment or client preview. Adversarial check against the original strategy + plan.

---

## Quick Reference — When to Use What

| Change type | Start at |
|-------------|----------|
| New page / new section | Phase 1 (Strategy) |
| Visual redesign of existing section | Phase 2 (Design Direction) |
| New interactive feature (booking, forms) | Phase 1 (Strategy) |
| Add animation / scroll effect to existing section | Phase 2 (Design Direction) |
| Bug fix / performance / refactor | Phase 4 (Plan) |
| Backend-only (API route, email) | Phase 4 (Plan) |
| Copy change / content update | Just do it |

---

## Design Rules

- **Glassmorphism** for overlay cards: `backdrop-filter: blur(12px)` + semi-transparent bg + subtle border
- **Variable fonts** preferred — see vault `resources/tls-variable-font-stack.md`
- **Micro-interactions are baseline** — every section needs at minimum scroll-triggered reveals + hover states
- **Multi-channel contact always** — form + phone + email on every page with a CTA
- **Font rationale required** — never pick a font without documenting why in the mood board
- **Gradient transitions** must feel intentional — every color shift needs a reason tied to the emotional arc
- Colors follow Material Design 3 roles — see `tailwind.config.ts`
- French-first copy — all UI text in French, `tu` (not `vous`)

## Don'ts

- Don't add pages without updating `ORCHESTRATOR.md`
- Don't add dependencies without justifying in the plan
- Don't use inline styles for animations — use composables or Tailwind utilities
- Don't skip mobile testing — mobile-first responsive design
- Don't hardcode copy — all user-facing text should be easy to find and update
- Don't modify `TheNav.vue` scroll listener without fixing the cleanup leak first
