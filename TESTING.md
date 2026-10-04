# Testing

Three layers, all runnable offline from secrets: no Google, Resend, Brevo, Twilio, Anthropic, Turso or Meta credential is needed or used.

| Command | What | Time (M-series Mac) |
|---|---|---|
| `bun run typecheck` | `nuxt typecheck` (vue-tsc, strict) gated against `tests/typecheck-baseline.json` | ~10 s |
| `bun run test` | Vitest: unit + server-route tests, network blocked | ~2 s |
| `bun run build` | Production build (Vercel preset) | ~25 s |
| `bun run test:smoke` | Builds with the `node-server` preset, serves it, runs Playwright (Chromium, headless) | ~45 s |

First time: `bun install`, then `bunx playwright install chromium`.

## Typecheck baseline

`main` already had 40 type errors when CI was added, mostly `noUncheckedIndexedAccess`, which Nuxt 4 turns on. Fixing them means touching site code, which was out of scope for the CI change. So `scripts/typecheck-baseline.ts` fails only on **new** errors, keyed by file + TS code + message (not line numbers). After fixing some, run `bun run typecheck:update-baseline` and commit the smaller baseline.

## What's covered

**Server routes** (`tests/server/`): each handler runs through a real h3 app, with `useRuntimeConfig`/`$fetch` doubles and Google Calendar, Twilio and Brevo mocked:
- `booking/availability`: param validation, booking window, working hours, 24 h notice, 15 min buffer, 60/90 min services, 5 min cache, Google failure → 503
- `booking/create`: all 400 paths, 409 (taken slot / closed day / notice), 503 paths, happy path (one event, client + therapist emails, SMS only with consent, Meet link for video), notification failures don't fail a booking, Meta CAPI skipped when unconfigured
- `booking/cancel-info`, `booking/cancel`: 400/404/503, single-use behaviour, notifications, SMS consent
- `contact`, `newsletter/subscribe`: validation, honeypot, 503 when unconfigured, HTML escaping, Brevo double opt-in
- `img-proxy`: SSRF host allowlist, protocol checks, non-image refusal
- trigger.dev tasks `review-request` (Turso dedupe, opt-out, 180-day repeat, failure isolation) and `booking-reminder` (email + SMS, manual calendar bookings, failure isolation)

**Units** (`tests/unit/`): input sanitizers, Google key normalization, email templates (XSS), SMS phone normalization/bodies, booking slot math (incl. DST), ICS/Google Calendar links, services, `useBooking`/`useContact`, Meta CAPI hashing, weekly brief (Anthropic mocked).

**Smoke** (`tests/smoke/`), against the real production build:
- every page in `pages/` returns 200 with its key heading, `lang="fr"` and French copy, and every image decodes. A new page without an entry in `PAGES` fails on purpose.
- a blog article renders its markdown, every article is prerendered, and the index lists every article
- booking flow: service → date → time → validation errors → submit (API mocked at the network layer) → confirmation, plus the 409 message
- contact form: required-field validation, mocked submit, failure fallback
- cancellation page (`/annuler`): confirm → cancelled, plus the expired link
- legacy Wix 301s, client-side navigation, 404 page, sitemap/robots
- design system: Tailwind theme colours, spacing and fonts are actually applied (catches a CSS pipeline that builds but emits nothing)
- axe on the home page: fails on any serious/critical violation except the pre-existing `color-contrast`

Every smoke test also fails on any console error or uncaught exception, and on any same-origin asset returning ≥ 400. Third-party requests (GA4, Meta Pixel, PostHog, Wix/Unsplash images) are answered locally, so CI never pollutes Chantal's analytics. Images from a host not in `ALLOWED_IMAGE_HOSTS` fail the suite.

Known gaps:
- `test.fixme`: the Google Ads deep link `/prendre-rendez-vous?book=open&service=couple` is broken in production (the modal doesn't open). Un-fixme the test once it's fixed.
- Real deliverability of Resend/Brevo/Twilio/Google and the external image CDNs is out of scope by design.

## CI and the dependency autopilot

`.github/workflows/ci.yml` runs on every PR and on pushes to `main`, as one job named **`ci`**: frozen install → typecheck → test → build → smoke. Use `gh pr checks` to see its result.

The autopilot (`~/.claude/tools/dep-checks.ts`) runs locally, in this order: `bun install --frozen-lockfile`, `bun run test` (tests gate), then `bun run typecheck` and `bun run build` (build gate). It then requires the `ci` check to be green before auto-merging a version bump. The smoke suite runs only in CI.
