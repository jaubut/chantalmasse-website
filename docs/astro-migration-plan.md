# Astro migration plan — chantalmasse.com

Status: **PLAN ONLY**. Nothing in this doc has been executed. No code, deploy, DNS or live-service change.
Target: Astro 7.4+ · `@astrojs/cloudflare` · `<ClientRouter />` view transitions · reference `jaubut/le-brouemont-maquette`.
Inventory taken 2026-11-19 from `main` @ `f43d8db` plus read-only GETs against the live site.

---

## 1. Inventory: what the live site does today

### 1.1 Routes (live status observed 2026-11-19)

| URL | Source | Render | Index | Notes |
|---|---|---|---|---|
| `/` | `pages/index.vue` | prerendered | yes | 200 |
| `/coaching-de-couple` | `pages/coaching-de-couple.vue` | prerendered, `layout: false` | yes | Ads landing page |
| `/therapie-individuelle` | `pages/therapie-individuelle.vue` | prerendered, `layout: false` | yes | Ads landing page |
| `/prendre-rendez-vous` | `pages/prendre-rendez-vous.vue` | prerendered | `noindex, nofollow` | booking landing page (A/B vs `/`), **but listed in sitemap** |
| `/journey` | `pages/journey.vue` | prerendered | yes | GSAP scroll piece (`components/journey/*`) |
| `/blog` | `pages/blog/index.vue` | prerendered | yes | `queryCollection('blog')` |
| `/blog/<slug>` (24 posts) | `pages/blog/[slug].vue` + `content/blog/*.md` | prerendered | yes | newsletter form inline |
| `/mentions-legales`, `/confidentialite`, `/confidentialite-infolettre` | `pages/*.vue` | prerendered | yes | Law 25 notices |
| `/inscription-confirmee` | `pages/inscription-confirmee.vue` | prerendered | `noindex` | excluded from sitemap |
| `/confirmer-inscription#t=<token>` | `pages/confirmer-inscription.vue` | prerendered, robots off | `noindex` | token in fragment, **analytics suppressed on this path** |
| `/annuler?token=` | `pages/annuler.vue` | **SSR** (per token) | `noindex, nofollow` | booking cancel |
| 404 | `error.vue` | SSR | `noindex` | `/nope` → 404 |
| `/sitemap.xml` | `@nuxtjs/sitemap` (+ `content.config.ts` `defineSitemapSchema`) | runtime | — | 33 `<loc>`, no trailing slash, no `lastmod` emitted |
| `/robots.txt` | `@nuxtjs/robots` | runtime | — | `Disallow:` (empty) + sitemap line |
| `/__sitemap__/style.xsl` | sitemap module | runtime | — | cosmetic |
| `layouts/admin.vue` | — | unused | — | no page uses it; do not port |

**Trailing slashes (critical, observed live):** every non-root page answers `307 → /<path>/` and only the slash form returns 200. Canonicals (`useHead` in each page) and sitemap `<loc>` use the **no-slash** form. So Google sees canonical → 307 → 200 on a different URL. This is existing behaviour (most likely Workers assets `auto-trailing-slash` over Nitro's `<route>/index.html` prerender output; confirm in Stage 0); the migration must reproduce it exactly or fix it deliberately, never change it by accident.

**Hosts:** `https://www.chantalmasse.com/` answers **200** (no redirect to apex). Duplicate-host risk exists today.

**Redirects** (`public/_redirects`, real 301s that keep `gclid`/`utm`; mirrored in `nuxt.config.ts` `routeRules`):
`/coaching-relationnel-couple[/]`, `/coaching-relationnel-de-couple-chantal[/]` → `/coaching-de-couple/` · `/therapie-individuelle-chantal[/]` → `/therapie-individuelle/` · `/book-online[/]`, `/booking-calendar[/]` → `/` · `/services[/]` → `/prendre-rendez-vous/`. The `routeRules` copies also emit meta-refresh stubs that drop the query string (STATE.md 2026-11-17); `_redirects` wins on Cloudflare.

### 1.2 SEO metadata
- Per page: `useSeoMeta` (title, description, og:*, `ogImage` = `/images/chantal-hero.jpg` or the post `image`) + `useHead` canonical. `titleTemplate: '%s'`. `lang="fr"`.
- JSON-LD (via `@nuxtjs/seo` / nuxt-schema-org, `nuxt.config.ts` `schemaOrg.identity`): `Person` (+`PostalAddress` Shefford QC), `WebSite`, `WebPage` (+`ReadAction`). **No `Article`/`BlogPosting`, no `FAQPage`, no `LocalBusiness`.**
- No hreflang (FR only). `ogImage` generator disabled. `robots` meta default `index, follow, max-image-preview:large, …`.

### 1.3 Content sources
- Blog: `content/blog/*.md` (24 files), schema in `content.config.ts` (`slug, title, date, readTime, category, excerpt, image, originalUrl?`), rendered by `@nuxt/content` v3 (`better-sqlite3` at build).
- **Blog publishing flow (external):** `draft-chantal-article` skill reads queue note **RES-B88Z** (Turso) → writes a Turso draft note → `POST https://jeremie.apies.dev/api/blog-drafts` (tls-dashboard-v2) → Chantal approves in the partner portal → `tls-dashboard-v2/server/lib/blog-publish.ts` **commits `content/blog/<slug>.md` to `jaubut/chantalmasse-website@main`** via GitHub contents API (create-only, frontmatter built by js-yaml, hero image hosts `images.unsplash.com`/`chantalmasse.com`). `blog_drafts` table tracks `commit_sha`/status.
- Hardcoded copy: `utils/journey-data.ts`, `utils/bookingServices.ts`, `utils/newsletterConsent.ts` (approved consent text `2026-11-v1`), section components.

### 1.4 Server routes (Cloudflare Worker, `server/api/`)
| Route | Purpose | Dependencies |
|---|---|---|
| `GET /api/booking/availability` | free slots per month | Google Calendar (service account), KV `BOOKING_CACHE` (`server/utils/bookingCache.ts`) |
| `POST /api/booking/create` | create event, live re-check | Calendar, Resend (client + therapist emails, `server/utils/email{Layout,Templates}.ts`), Twilio SMS opt-in (`server/utils/sms.ts`), Meta CAPI `Schedule` (`server/utils/metaCapi.ts`), static Meet link |
| `GET /api/booking/cancel-info`, `POST /api/booking/cancel` | token cancel | Calendar, Resend |
| `POST /api/contact` | contact modal | Resend; honeypot field `website` |
| `POST /api/newsletter/subscribe`, `/confirm` | double opt-in proxy | `https://dashboard.apies.dev/api/public/newsletter/*` (`server/utils/newsletterApi.ts`, Origin check, CF IP, honeypot) |
| `GET /api/img-proxy` | image proxy (Instagram referer) | **no caller in pages/components**; only tests |

Node-only libs shimmed via Nitro aliases: `server/shims/googleapis-calendar.ts`, `twilio.ts`, `empty.ts` (`@react-email/render`). `server/plugins/css-first.ts` rewrites the head so JS starts after CSS.
Spam protection today: honeypot + server-side input cleaning (`server/utils/input.ts`) + newsletter Origin check. **No Turnstile, no rate limit.**

### 1.5 Booking flow
`components/BookingSection.vue`, `BookingStickyBar.vue`, `components/booking/*` (ServiceSelector → MonthCalendar → TimeSlotPicker → IntakeForm → ConfirmationView in `BookingModal.vue`), `composables/useBooking.ts`, `utils/bookingHelpers.ts`, `utils/bookingServices.ts`. Emails: client confirmation, therapist notification, cancellation, reminder (Trigger.dev). Rules shared with tasks: `server/utils/chantalSessionRules.ts`.

### 1.6 Scheduled jobs (Trigger.dev, project `proj_owvqgxdwexjdaeewzkfl`, `trigger.config.ts`)
`trigger/booking-reminder.ts` (hourly), `trigger/review-request.ts` (daily 10:00 ET, Turso `chantal_review_requests`), `trigger/weekly-brief.ts` (Wed 09:00 ET, Anthropic + Apify + GA4/Ads). Deployed by `.github/workflows/trigger-deploy.yml` on push to `main` when `trigger/**`, `server/utils/**`, `utils/**` change. **They import `server/utils/*` and `utils/*` directly** — moving those files breaks the tasks and the workflow path filter.

### 1.7 Analytics & tracking
- Inline in `nuxt.config.ts` `app.head.script`: GA4 `G-CTE3NV511W` (gtag, also loads linked Ads `AW-16485477025`), Meta Pixel `948606391153047` + noscript pixel; libs injected after CSS; all skipped on `/confirmer-inscription`.
- `composables/useTracking.ts`: `booking_confirmed` + direct Ads conversion `AW-16485477025/IFK1CJuhqrodEKHV8bQ9` with `transaction_id`, Meta `Schedule` with `eventID` (deduped against server CAPI), `generate_lead` (contact only, secondary Ads action), `begin_checkout`, PostHog mirrors.
- `plugins/posthog.client.ts`: cookieless PostHog (`persistence: 'memory'`, masked inputs), manual `$pageview` on each route change.
- No consent banner / Consent Mode today. Ads scripts: `scripts/ads-*.ts`, `scripts/ads-relaunch.py` (operator CLIs, not runtime).
- Intro loader inline script (`sessionStorage cm-intro`), page veil transition `plugins/page-veil.client.ts`.

### 1.8 Assets
Fonts: Google Fonts Newsreader (ital/wght 400/600/700) + Manrope 300/400/600 via `@nuxtjs/google-fonts`, `display: swap`. Material Symbols. Images: `public/images/chantal-hero.jpg`, Unsplash + `static.wixstatic.com` URLs in posts/components, `@nuxt/image`. Styles: Tailwind v4 `@theme` (MD3 roles) in `assets/css/main.css`. GSAP for scroll.

### 1.9 Config, env and secrets (names only)
Worker runtime: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO`, `CHANTAL_MEET_LINK`, `BOOKING_MIN_NOTICE_HOURS`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `SITE_BASE_URL`, `NEWSLETTER_API_BASE`, `NEWSLETTER_SITE_KEY` (+ `NUXT_*` twins of all the above), `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE` (Meta ones reported missing on the Worker). Build-time public: `NUXT_PUBLIC_POSTHOG_KEY`, `NUXT_PUBLIC_POSTHOG_HOST`, `BOOKING_TIMEZONE`, `BOOKING_ADVANCE_DAYS`. Binding: KV `BOOKING_CACHE`.
Trigger.dev env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `REVIEW_EMAIL_FROM`, `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN`, `BRIEF_EMAIL`, `CHANTAL_FB_USERNAME`, `CHANTAL_IG_USERNAME`, Google + Resend + Twilio as above. Repo secret: `TRIGGER_ACCESS_TOKEN`. Local-only scripts: `GOOGLE_ADS_*`.
Dashboard side (not this repo): `BLOG_PUBLISH_GITHUB_TOKEN`, `TRIPS_API_KEY`.

### 1.10 Hosting & deploy
- Cloudflare Worker `chantalmasse-website` (Nitro `cloudflare_module`, `nodejs_compat`, observability on, wrangler config generated into `.output/server/wrangler.json`). Static assets served by Workers assets.
- Deploy is **manual**: `bun run build` → `bunx wrangler deploy --config .output/server/wrangler.json` (or `versions upload` + `versions deploy`). No GitHub Action deploys the site.
- CI: `.github/workflows/ci.yml` (typecheck baseline, vitest, Cloudflare build, Playwright smoke on a `node-server` build).
- DNS / custom-domain routing for `chantalmasse.com` + `www`: **not in the repo** (see open questions).

---

## 2. Risks and how each is protected

| # | Risk | Impact | Protection |
|---|---|---|---|
| R1 | URL shape changes (slash vs no-slash, 307 vs 301, `index.html` handling) | rankings, Ads final URLs, Search Console | Stage 2 crawl diff against a frozen baseline of every URL in sitemap + redirects + Ads final URLs; cutover blocked on zero diffs. Astro `build.format: 'directory'` + assets `html_handling: auto-trailing-slash` reproduces today; any fix (→ `trailingSlash: 'never'` + 301) is a separate post-watch change |
| R2 | Canonical / meta / JSON-LD drift | rankings, rich results | per-URL diff of `<title>`, description, canonical, robots, og:*, JSON-LD types+fields |
| R3 | Sitemap or robots differs | crawl budget, de-indexing | byte-level diff of `<loc>` sets; same exclusions; robots identical |
| R4 | Redirects lost or turned into meta-refresh | Ads clicks lose `gclid`, legacy backlinks 404 | keep `public/_redirects` as the only redirect source; **do not** use Astro `redirects` config (static output = meta-refresh); test each with `?gclid=x&utm_source=y` preserved |
| R5 | Ads conversion breaks or double-counts | paid budget wasted, bidding corrupted | same `send_to`, `transaction_id`, `booking_confirmed`; Tag Assistant + GA4 DebugView on preview; Ads "Conversions → Diagnostics" daily for 14 days post-cutover |
| R6 | Pageviews break under ClientRouter (soft navigations no longer reload gtag/fbq/PostHog) | GA4/Meta/PostHog undercount or double count | one `astro:page-load` listener sends `page_view` / `PageView` / `$pageview`; gtag `send_page_view: false` after first; test count = 1 per navigation |
| R7 | Token leak on `/confirmer-inscription` | privacy (Law 25) | keep path exclusion in every analytics init **and** in the page-load listener; smoke test asserts zero analytics requests |
| R8 | Booking API regression (Worker CPU 1102, KV cache, shims) | lost clients | port handlers 1:1, keep shims as Vite aliases, run existing `tests/server/*` against the new handlers, load test `scripts/load-test-availability.ts` on preview |
| R9 | Emails/SMS sent from preview to real clients | trust, CASL | preview Worker gets a **test** calendar ID + Resend test key/`EMAIL_TO` = Jeremie, no Twilio creds, `META_CAPI_TEST_EVENT_CODE` set |
| R10 | Trigger.dev tasks break because `server/utils` moved | reminders/review emails stop silently | keep `server/utils/*` + `utils/*` paths (Astro imports them) or move them and update `trigger-deploy.yml` paths + imports in one PR; check task run `version` after deploy |
| R11 | Blog publish flow breaks | Chantal's approvals fail or don't go live | keep `content/blog/*.md` path and frontmatter schema unchanged; dashboard `BLOG_PUBLISH_TARGETS` untouched; Stage 4 publishes one test draft to a branch preview |
| R12 | Newsletter double opt-in breaks | subscribers lost | same endpoints/Origin check/consent text; end-to-end with a Jeremie address on preview |
| R13 | Spam increase | inbox noise | honeypot ported verbatim; Turnstile is a separate, optional follow-up (not in parity scope) |
| R14 | Performance regression | Ads Quality Score, Lighthouse < 85 | Lighthouse mobile on 5 key URLs before/after; Astro ships less JS by default |
| R15 | Rollback slow | outage | Nuxt Worker version kept deployable; cutover = `wrangler versions deploy` / route swap, rollback is the same command back |

---

## 3. Migration plan

Principle: **parity first, improvements later.** No copy, design, URL, tracking or SEO change rides along with the migration.

### Stage 0 — Freeze the baseline
- Script a crawl of: sitemap URLs, slash + no-slash variant of each, every `_redirects` source with `?gclid=test&utm_source=test`, Ads final URLs (from `scripts/ads-audit.ts`), `/robots.txt`, `/sitemap.xml`, `/nope`, `www.` root. Record status, `Location`, title, description, canonical, robots, og:*, JSON-LD, `<h1>`.
- Export Search Console indexed pages + top queries (90 days), GA4 + Ads conversion baselines (last 28 days), Lighthouse mobile/desktop for `/`, `/coaching-de-couple/`, `/therapie-individuelle/`, `/prendre-rendez-vous/`, one blog post.
- Note the live Worker version ID (rollback target).
- **Accept:** baseline JSON + reports committed under `docs/migration-baseline/`; Worker version ID recorded.

### Stage 1 — Scaffold Astro alongside Nuxt (branch only)
- Astro 7.4+, `@astrojs/cloudflare`, `output: 'static'`, `session: false`, `build.format: 'directory'`, Tailwind v4 via Vite, `site: 'https://chantalmasse.com'`. Worker name for preview: `chantalmasse-website-astro` (never the prod name).
- Keep Vue booking/contact/newsletter components as islands via `@astrojs/vue` (`client:visible`/`client:idle`) to avoid rewriting the riskiest UI; static sections become `.astro`. (New dep, justified: booking rewrite is the biggest risk otherwise.)
- Layout with `<ClientRouter />`, head scripts (intro loader, gtag, fbq, deferred libs) marked `is:inline`, the analytics page-load listener (R6/R7). Page veil → view transitions.
- Content collection with `glob({ base: './content/blog' })` and the same zod schema.
- **Accept:** `astro build` green in CI next to the Nuxt build; every route in §1.1 renders on `wrangler dev`.

### Stage 2 — Server routes + parity build on a preview URL
- Port `server/api/**` to `src/pages/api/**` (`prerender = false`), `/annuler` SSR. Replace `useRuntimeConfig`/`readBody`/`createError` with `cloudflare:workers` `env` and `Request`/`Response`; keep `server/utils/*` framework-free so Trigger.dev keeps importing them. Shims as Vite aliases. KV `BOOKING_CACHE` binding (separate preview namespace).
- Sitemap: `@astrojs/sitemap` or a small endpoint reproducing the exact 33-URL set and exclusions; `robots.txt` static file with identical content. `public/_redirects` copied as is.
- JSON-LD: one `.astro` component emitting the same Person/WebSite/WebPage graph.
- Deploy to the preview Worker (`*.workers.dev` or `preview.chantalmasse.com`, `noindex` header on preview).
- **Accept:** baseline crawl re-run against preview with host rewritten → zero diffs in status, `Location`, title, description, canonical, robots, og:*, JSON-LD, sitemap `<loc>` set, robots body (except the documented `X-Robots-Tag: noindex` on preview). Existing vitest server tests pass against the ported handlers; Playwright smoke suite points at preview and passes.

### Stage 3 — Performance and tracking verification
- Lighthouse mobile/desktop on the 5 baseline URLs: no metric worse than baseline, mobile ≥ 85.
- GA4 DebugView + Tag Assistant + Meta Pixel Helper + PostHog live events on preview: one `page_view` per full load and per ClientRouter navigation; `begin_checkout`, `booking_confirmed` + Ads `conversion` with `transaction_id`, Meta `Schedule` with `eventID`, `generate_lead` (contact only); nothing on `/confirmer-inscription`.
- `prefers-reduced-motion`, 390×844 and 1440×900 visual check vs baseline screenshots; axe smoke (`tests/smoke/a11y.spec.ts`).
- **Accept:** event matrix filled in the PR with screenshots; Lighthouse table before/after.

### Stage 4 — End-to-end in test mode
- Booking on preview against a **test calendar**: in-person + video, couple + individual, cancel via emailed link; check KV invalidation, client/therapist/cancel emails (Resend to Jeremie), SMS disabled, Meta CAPI with test event code.
- Contact form + honeypot; newsletter subscribe → confirm email → `/confirmer-inscription` → dashboard subscriber row (Jeremie address).
- Blog: dashboard publish of one test draft to a **branch** (not `main`) → preview build shows it.
- Trigger.dev: `bun run test:reminder` + `test:rules` + `tests/server/trigger-*` green with the final file layout.
- **Accept:** all flows pass, logs attached to PR; no real client touched.

### Stage 5 — Cutover with instant rollback
- Pick a low-traffic window (not a send day of an Ads change). Merge the Astro PR; deploy the Astro build as a new version of Worker `chantalmasse-website` (same secrets, same KV, same routes) using `wrangler versions upload` + `versions deploy`. Nuxt version stays in Worker version history and its build artifact is kept (`git tag nuxt-final`).
- Immediately re-run the baseline crawl against production + one real-calendar availability read (no booking).
- **Rollback:** `wrangler versions deploy <nuxt-version-id>@100%` (seconds). Trigger: any crawl diff, 5xx, booking error, missing conversion tag.
- **Accept:** prod crawl zero diffs; Worker error rate ≤ baseline for 1 h; Jeremie does one manual mobile pass.

### Stage 6 — Post-cutover watch (14 days)
- Daily: Worker errors/CPU, booking count vs same weekdays prior, Ads conversions + Diagnostics, GA4 key events, Search Console coverage/crawl errors, Resend bounces, Trigger.dev run versions.
- Day 1: resubmit sitemap in Search Console; URL-inspect the 5 key URLs.
- Day 14: if clean, delete the Nuxt code from `main` and close the rollback window; then (separately) consider trailing-slash/canonical fix, `www`→apex 301, `Article` JSON-LD, Turnstile.
- **Accept:** 14 days with no drop beyond normal variance in indexed pages, impressions, conversions.

---

## 4. Effort and open questions

| Stage | Effort | Owner |
|---|---|---|
| 0 Baseline | ~0.5 day | agent (+ Jeremie for GSC/Ads exports) |
| 1 Scaffold + pages (Vue islands kept) | ~2–3 days | agent |
| 2 Server routes + parity preview | ~1.5–2 days | agent |
| 3 Perf + tracking | ~0.5–1 day | agent + Jeremie (DebugView access) |
| 4 E2E test mode | ~0.5–1 day | agent + Jeremie (test calendar, inbox) |
| 5 Cutover | ~0.5 day | Jeremie present |
| 6 Watch | 14 days, ~10 min/day | agent digest, Jeremie decides |
| **Total build** | **~6–8 days** | |

Open questions for Jeremie:
1. **Why migrate now?** The Nuxt site is stable, Ads just relaunched (2026-11-17). Proposal: start Stage 0 now, cut over only after the Ads relaunch has 2–4 weeks of clean conversion data.
2. **Blog go-live path:** the portal commits to `main`, but site deploys are manual. Is Cloudflare Workers Builds (git integration) connected, or do approved articles wait for a manual deploy? The answer decides how Astro deploys must be wired.
3. **Trailing slash:** reproduce today's 307-to-slash exactly (recommended for cutover) or switch to `trailingSlash: 'never'` + 301 in a later change?
4. **`www.chantalmasse.com`** serves 200 without redirect. Fix (301 → apex) as a separate change after the watch?
5. **DNS / routing:** is `chantalmasse.com` a Cloudflare zone with the Worker on a custom domain or a route? Who owns the registrar?
6. **Astro version:** the reference repo pins `astro 7.3.8` / `@astrojs/cloudflare ~14.3.4`, not 7.4+. Bump the reference too, or accept 7.3.x here?
7. **Vue islands vs full rewrite** of the booking modal: keep Vue (lower risk, +1 dep) or rewrite in Astro + vanilla TS (matches reference, more test surface)?
8. **`/api/img-proxy`** has no caller in the site. Drop it during the migration (smaller attack surface) or is something external using it?
9. **`/prendre-rendez-vous`** is `noindex` but in the sitemap; `/journey` is indexed. Keep both as is for parity?
10. **Test calendar + Resend test key** for preview E2E: create a dedicated Google calendar shared with the service account?
11. **Meta CAPI secrets** are still missing on the Worker (STATE.md): set them before or after the migration (keeps the baseline comparable if after)?
12. **Consent banner / Consent Mode v2:** none today. Out of scope for parity; confirm.
