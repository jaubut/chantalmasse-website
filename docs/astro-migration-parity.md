# Astro migration — parity report (stages 0–4)

Date: 2026-11-20. Plan: `docs/astro-migration-plan.md` (PR #52). Branch `dispatch/434003b2…`.
Preview: **https://chantalmasse-website-astro.jeremie-aubut.workers.dev** (Worker `chantalmasse-website-astro`, workers.dev only, `X-Robots-Tag: noindex` on every response).
Production was not touched: no deploy to `chantalmasse-website`, no DNS, no zone rule, no Ads change.
Rollback target recorded at Stage 0: live Worker version **`d8f22b85-1835-471c-a323-686da909e2da`** (main `771bd9e`).

## Verdict

| Gate | Result |
|---|---|
| Crawl parity (84 URLs: status, Location, title, description, canonical, robots meta + header, og:*, twitter:*, JSON-LD, h1, lang; sitemap `<loc>` set; robots.txt) | **0 diffs except one class: `og:image` on the 24 posts** (needs Jeremie's OK, see below) |
| Redirects: 12 legacy `_redirects` sources with `?gclid&utm`, `/path/` → `/path`, `//x` | identical (same `public/_redirects`, applied by Workers assets before the Worker) |
| www → apex (6 zone rules) | not testable on workers.dev; zone Redirect Rules run before any Worker version, so the swap can't change them. Re-check after cutover: `bun scripts/check-urls.ts https://chantalmasse.com https://www.chantalmasse.com` |
| API parity (14 validation/error requests, live vs preview, byte diff) | identical, except `/api/newsletter/subscribe` without Origin: 503 on preview (no `NEWSLETTER_SITE_KEY` there) vs 403 live |
| Tracking (full load + ClientRouter navigations, collection hits recorded and aborted) | identical counts to production: GA4 / Ads `page_view` and 1 Meta `PageView` per navigation; zero third-party requests on `/confirmer-inscription` |
| Smoke suite (`tests/smoke`, 54 tests) against the preview | **54/54** (second pass: the CSS-first test passes now) |
| Unit/server tests, typecheck gates | 203/203; Nuxt `typecheck: OK (39 known baseline errors, 0 new)`; `astro check` 0 errors (now a CI step) |
| Lighthouse (second pass, final build) | **mobile ≥ baseline on all 5 URLs** (`/` 63 → 85, `/prendre-rendez-vous` 56 → 87, CLS on `/coaching-de-couple` 0.005); desktop ≥ baseline on all 5 (first pass) |
| E2E in test mode (booking, newsletter, contact, blog publish) | **not run**: needs preview secrets and the CMS write token (see "What Jeremie needs to provide") |

**Cutover is not ready**: the blog reads the **staging** CMS and no production `tls-cms` exists yet (blocker 1 below).

## How it's built (and why)

- `astro/` next to Nuxt, sharing `package.json`, `public/` (incl. `_redirects`), `assets/css/main.css`, `server/`, `utils/`, `composables/useTracking.ts`. Nuxt files are unchanged except a one-line `typescript.tsConfig.exclude` so `nuxt typecheck` ignores `astro/`. Trigger.dev tasks and `trigger-deploy.yml` paths are unaffected.
- **API routes: the existing `server/api/*` handlers run unchanged** behind one h3 router (`astro/src/pages/api/[...path].ts`, globals in `astro/src/lib/nitro.ts`), the same way `tests/server/*` already exercises them. Zero handler rewrite = zero logic drift, and the existing server tests keep covering the code that ships. Error bodies keep Nitro's JSON shape byte for byte; an uncaught non-H3 error is masked as 500 "Server Error" with no data, as Nitro does in production. Shims (`googleapis`, `twilio`) are the same Vite aliases.
- **Booking/contact/newsletter UI: kept as Vue islands** (`astro/src/vue/**`, copies with explicit imports). Rewriting the booking flow in vanilla TS was the plan's biggest risk; the islands pass the existing booking/contact smoke tests (mocked APIs, conversion assertions) unchanged. Static sections render without hydration; CTAs use `data-booking-open` / `data-contact-open` handled by `astro/src/lib/client.ts`. The modals are `client:only` (they Teleport to `<body>`, which SSR drops).
- **View transitions**: `<ClientRouter />` in `astro/src/layouts/Base.astro`; the Nuxt page veil runs on the ClientRouter lifecycle.
- **Page views on every in-site navigation**: verified against production. The Google tag and the Meta pixel count ClientRouter navigations with their own history listeners, exactly as under Nuxt's router (1 each); PostHog gets one `$pageview` per `astro:page-load` (PostHog is off on both today: no key baked at build). One trap found and fixed: ClientRouter parses the next page with scripting off, so the `<noscript>` pixel `<img>` fired an extra Meta PageView per navigation; it is now `transition:persist`.
- **SEO head**: `astro/src/lib/seo.ts` reproduces `@nuxtjs/seo` output (robots defaults, og:*, the Person/WebSite/WebPage graph). Kept on purpose for parity, fix after cutover: blog posts emit an **empty** `<meta name="description">` today (live bug), robots.txt keeps its `nuxt-robots` comment lines, 404 responses carry `X-Robots-Tag: index, follow…` like Nuxt.
- **URL shape**: `build.format: 'file'` + `trailingSlash: 'never'` + the same `_redirects` = same no-slash URLs and one-hop 301s.
- **Blog on the TLS CMS** (Jeremie's decision): companion PR **jaubut/tls-dashboard-v2#468** imports the 24 posts once into site `chantal-masse` (staging D1 `tls-cms-chantal-masse-staging`), with a coverage test, and adds "approve publishes via the CMS" behind `BLOG_PUBLISH_TARGET` (default stays `github`). The Astro blog (`/blog`, `/blog/<slug>`, the 2 latest posts on `/`, `/sitemap.xml`) reads it at request time through `astro/src/lib/cms-client.ts` over a service binding (`CMS` → `SiteReads`); media at `/media/<key>` (engine's `Image.src`). No rebuild per article.
- **CMS-backed pages are cached** (`astro/src/middleware.ts`): HTML in KV per path, keyed by Worker version (cached HTML points at that deploy's hashed assets), served at once and re-rendered in the background when older than 60 s. Each isolate starts at most one re-render per page per minute (stamped before it starts, so a failing CMS is retried once a minute, not on every request), KV is written only when the HTML changed and with a 7-day TTL, a cached page that now 404s (unpublished or renamed post) is dropped while a cold 404 (bots, typos) costs no KV call at all, the logic lives in `astro/src/lib/page-cache.ts` with unit tests (`tests/unit/page-cache.test.ts`), and a degraded render (home with the CMS down: no blog cards) is served but never cached. CMS media (`/media/<key>`) only passes the widths the templates use (640, 960, 1200, 1280, 1920), only serves raster `image/*` with `nosniff`, and caches each variant at the edge (Cache API) and in KV with a 30-day TTL, so writes are bounded by posts × widths × 3 formats.
- Icons: `@iconify/vue` fetched `api.iconify.design` at runtime; `astro/src/icons.json` (generated, 41 icons) renders them at build time.
- Fonts: Astro Fonts API self-hosts Newsreader/Manrope like `@nuxtjs/google-fonts` did; no preload (preloading delayed FCP/LCP on mobile by ~1 s in measurements).
- Versions: astro 7.4.13, @astrojs/cloudflare 14.4.9, @astrojs/vue 7.1.6, wrangler 4.165.0 (new deps: these + `ofetch`, `@iconify-json/mdi`, `@iconify/utils`).

## Diffs that need Jeremie's sign-off

1. **`og:image` on the 24 posts** now points to the self-hosted CMS copy of the same picture (`https://chantalmasse.com/media/sites/chantal-masse/media/<sha>.jpg`) instead of the Wix/Unsplash hotlink. This is the CMS design (heroes in R2); keeping the external URL would need a contract change for a parity artifact. Recommendation: accept. Full list: `docs/migration-baseline/parity-diff-preview.txt`.
2. **Sitemap `<lastmod>`** (post date) added on posts: `content.config.ts` asked for it and `tests/smoke` expects it; the live Nuxt build drops it. `/__sitemap__/style.xsl` (cosmetic XSL) is gone.
3. **Post bodies**: 23/24 word-for-word identical to live. `apprendre-a-se-comprendre`: its table is a bullet list ("cell — cell"); 12 horizontal rules across 10 posts are dropped. The CMS contract has no `table` / `horizontalRule` node; PR #468 proposes the additive change.

## Lighthouse (mobile median of 3, Nuxt prod → Astro preview)

Second pass, 2026-11-20: Nuxt production and the Astro preview run **interleaved** (Nuxt, Astro, Nuxt, … for each URL, same machine, same minutes), because Nuxt's own home score moved between 62 and 87 across sessions with no code change (Lighthouse's simulated LCP is bimodal on that page). SEO is lower on the preview only because of its deliberate `noindex` header; best-practices are equal on every URL, a11y too except one timing-dependent axe hit on `/` (the rotating hero label caught mid-fade: same markup and colors as Nuxt; 98 in the interleaved round, 94 in the final-build round). The Astro column is the final pushed build (3 runs just after the interleaved round; the interleaved Astro medians, within ±3 points of it, are in the JSON).

| URL | perf | FCP | LCP | TBT | CLS | weight |
|---|---|---|---|---|---|---|
| `/` | 63 → **85** | 1.65 → 1.48 s | 7.73 → 3.39 s | 328 → 261 ms | 0.001 → 0.026 | 2509 → 1007 KB |
| `/coaching-de-couple` | 86 → **87** | 1.59 → 1.47 s | 1.75 → 2.08 s | 405 → 421 ms | 0.010 → 0.005 | 789 → 714 KB |
| `/therapie-individuelle` | 87 → **89** | 1.57 → 1.25 s | 1.73 → 1.36 s | 368 → 413 ms | 0.007 → 0.025 | 789 → 714 KB |
| `/prendre-rendez-vous` | 56 → **87** | 3.20 → 1.97 s | 9.50 → 2.89 s | 386 → 260 ms | 0.001 → 0.001 | 1700 → 835 KB |
| `/blog/l-amour-conscient` | 83 → **89** | 1.60 → 1.41 s | 3.32 → 2.62 s | 306 → 260 ms | 0.000 → 0.026 | 1067 → 895 KB |

First pass (before the fixes below): `/` 64, `/coaching-de-couple` 84 (CLS 0.111), `/therapie-individuelle` 86, `/prendre-rendez-vous` 51 (FCP 2.94 s), blog post 80. Desktop (first pass, 1 run): `/` 83 → 88, `/coaching-de-couple` 97 → 97, `/therapie-individuelle` 97 → 98, `/prendre-rendez-vous` 86 → 86, blog post 97 → 98.
Raw numbers: `docs/migration-baseline/lighthouse.json` (before), `lighthouse-before-after.json` (both passes).

**What closed the mobile gaps:**
- **JS after CSS** (`astro/src/lib/css-first.mjs`, as `server/plugins/css-first.ts` did for Nuxt): each `<script type="module" src>` becomes an inline module that imports it, at build time for static pages and in the middleware for rendered ones. The chunks no longer compete with the render-blocking CSS.
- **Intro loader and scroll reveal out of the module chain.** `has-js` hid every `[data-animate]` element until a deferred module ran, so hero text painted, was hidden, then re-painted late, and that late paint was the LCP. Both are inline scripts now (`astro/src/components/IntroLoader.astro`, end of `Base.astro`): elements already on screen are marked visible before the first paint. The overlay sits after `<main>` (it's fixed, z-index 100) so the first paint holds the hero too. Visible difference: on a full reload without the intro, above-the-fold content shows at once instead of Nuxt's hide-then-fade flicker; first visits (intro) and in-site navigations (veil) look the same.
- **Hero photo resized**: the 2570 px, 913 KB JPEG was served for every `srcset` width (Nuxt too). `public/images/hero/chantal-hero-<w>.webp` (41–184 KB, `astro/scripts/gen-hero.ts`) now back the widths the markup already declared; the JPEG stays as `src` and og:image.
- **Blog hero**: responsive `srcset` (640/960/1280/1920 through the CMS media route) with `fetchpriority="high"`, preloaded from `<head>`.
- **CLS on `/coaching-de-couple`**: the late swap of the italic Newsreader file re-wrapped the hero headline and moved the CTA row. That page alone preloads that one file (`preloadItalic`); preloading fonts everywhere cost ~0.9 s of first paint on other pages.
- **Home hero island** hydrates on `client:idle` (it only rotates a label and shows the map on hover; its CTA works before hydration via `data-booking-open`).

## PR #55 review findings (Claude + Gemini), addressed in the second pass

- `astro/src/lib/nitro.ts`: an uncaught non-H3 error answers 500 "Server Error" with no `data` (Nitro's production behaviour); internal error text never reaches visitors.
- `astro/src/pages/media/[...key].ts`: width allowlist (640, 960, 1200, 1280, 1920), every other query dropped; raster `image/*` only, `X-Content-Type-Options: nosniff`; Cache API first, KV with a 30-day TTL (bounded writes).
- `astro/src/middleware.ts`: per-isolate `refreshedAt` + in-flight guard (an unchanged page is re-rendered at most once per minute per isolate, no KV write), stale entry deleted when the page now 404s, 7-day TTL on puts, `.catch` attached before `waitUntil` (also in the media route).
- `astro/src/pages/index.astro`: a failing `latestPosts(2)` renders `/` without the two cards and skips the page cache (`x-page-cache-skip`, stripped before the response).
- `astro/src/lib/client.ts`: booking and contact modals close on `astro:before-preparation`, so ClientRouter's remount can't reopen or reset a booking on the next page (verified: 1 dialog open → 0 after an in-site navigation). The privacy link in the booking form opens in a new tab.
- `astro/src/lib/richtext.ts`: heading level limited to 2/3/4, image width/height must be positive integers, missing `content` arrays tolerated; `readTime` is optional in the three templates.
- CI: `bun run astro:check` (`astro sync` + `astro-check`, 0 errors) runs before the Astro build.
- Not changed (noted by the review as pre-existing, same as Nuxt): tap targets under 44 px on the calendar arrows, testimonial arrows and modal close buttons; CI build needs Google Fonts reachable.

## Tracking matrix (verified)

| Event | How verified | Result |
|---|---|---|
| Full-load page view (GA4, Ads, Meta) | Playwright, hits recorded + aborted, prod vs preview | identical |
| In-site navigation page view (ClientRouter) | same, 7 navigation runs over 3 page pairs | identical (Google tag `page_view`, 1 Meta `PageView`) |
| `/confirmer-inscription#t=…` | all third-party requests logged | preview: none (prod also loads Cloudflare Insights + iconify) |
| `begin_checkout`, `booking_confirmed` + Ads conversion with `transaction_id`, Meta `Schedule` with `eventID`, no conversion on 409 / unsuccessful 2xx / missing or empty booking ID | `tests/smoke/booking.spec.ts` on the preview (dataLayer assertions, mocked API) | pass |
| `generate_lead` on contact only | `tests/smoke/forms.spec.ts` on the preview | pass |
| GA4 DebugView / Tag Assistant / Meta Events Manager on the real accounts | — | **not done**: needs Jeremie's accounts; the probes abort hits on purpose so Chantal's data stays clean |

## Blockers before « Deploy Chantal » (stage 5)

1. **No production CMS.** The CMS now lives in the standalone repo **jaubut/tls-portal-cms** (portal + editor + `cms/worker`, task a81740c6); production deploys from there, not from tls-dashboard-v2. Checked read-only on 2026-11-20 (`main`, created 04:29 UTC): the plan still holds. Its `cms/worker/wrangler.jsonc` keeps the top-level Worker name `tls-cms` and the `SiteReads` entrypoint, so `astro/wrangler.jsonc` `env.production.services` (`tls-cms` / `SiteReads`) stays valid, and it still only deploys `--env staging`. What production needs, in that repo: a production env block (or the top level) with a `DB_CHANTAL_MASSE` D1 (new database, migrations applied), the `tls-cms` R2 bucket, the secrets `CMS_TOKEN_SECRET`, `PREVIEW_SECRET`, `PURGE_SECRET`, then the one-time 24-post import against it.
   - **The extraction predates PR #468**: tls-portal-cms has no `cms/importers/chantal-md.ts`, no `import-chantal-staging.ts`, no `DB_CHANTAL_MASSE` staging binding, and its `server/lib/blog-publish.ts` is the GitHub-only version. #468's changes have to land in tls-portal-cms (re-targeted there or ported), or they ship nowhere.
   - **Preview risk**: redeploying `tls-cms-staging` from tls-portal-cms as it is today drops the `DB_CHANTAL_MASSE` binding added by #468's deploy, and this preview's blog then answers 500 (`unknown site chantal-masse`). The binding (D1 `6f9ad6b3-0477-4a88-9f81-6fb27b051043`) must be in that repo's staging block before its next staging deploy.
2. **Blog publish via the CMS** lands in tls-portal-cms (see 1), then `bun scripts/apply-schema.ts` there for the two new `blog_drafts` columns, and `BLOG_PUBLISH_TARGET=cms` only at cutover (the GitHub path stays live until then; after cutover a GitHub commit no longer publishes anything).
3. **E2E in test mode** (stage 4) once the preview has test secrets.
4. Sign-off on the 3 diff classes above and the open perf items.

## What Jeremie needs to provide for the stage 4 e2e (names only, provide once)

**A. Preview site Worker `chantalmasse-website-astro`** — `cd astro && bunx wrangler secret put <NAME>` (top-level env = the preview; never `--env production`). Test values only:

| Name | Used by | Test value |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | booking availability / create / cancel | the existing service account |
| `GOOGLE_PRIVATE_KEY` | same | its key (raw PEM or `\n`-escaped both work) |
| `GOOGLE_CALENDAR_ID` | same | a **new test calendar** shared with the service account ("Make changes to events"), never Chantal's |
| `CHANTAL_MEET_LINK` | video booking emails | any test Meet room |
| `RESEND_API_KEY` | booking + contact + cancel emails | a Resend key |
| `EMAIL_FROM` | sender | an address on a Resend-verified domain |
| `EMAIL_TO` | therapist notification + contact form | Jeremie's address |
| `NEWSLETTER_SITE_KEY` | `/api/newsletter/*` → dashboard double opt-in | the site key the dashboard issues for chantalmasse (a test site key if one exists) |
| `META_PIXEL_ID` | Meta CAPI `Schedule` on booking | `948606391153047` |
| `META_CAPI_ACCESS_TOKEN` | same | the CAPI token |
| `META_CAPI_TEST_EVENT_CODE` | same, routes events to Events Manager › Test events | the code shown in Test events |

Plus one **var** (not a secret), so cancel links in test emails point at the preview: `SITE_BASE_URL=https://chantalmasse-website-astro.jeremie-aubut.workers.dev` (`wrangler secret put` works too, or add it under `vars` in `astro/wrangler.jsonc`). **Leave unset on purpose:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (no SMS from the preview; the code skips SMS without them).

Newsletter caveat: `server/utils/newsletterApi.ts` only accepts `Origin: https://chantalmasse.com` / `www`, so a browser on workers.dev gets 403 by design. The e2e sends the subscribe request with that Origin from a script, then completes `/confirmer-inscription#t=…` from the emailed link on the preview.

**B. CMS / portal (blog publish e2e)** — in **jaubut/tls-portal-cms**, once #468's publish path is there: on its staging deployment, `CMS_TOKEN_SECRET` (same value as on `tls-cms-staging`) and `BLOG_PUBLISH_TARGET=cms`. Nothing else: the preview Worker reads the CMS through its service binding with no secret.

## Cutover runbook (stage 5, only on « Deploy Chantal »)

```bash
# 0. Production CMS from jaubut/tls-portal-cms (blocker 1), deployed there, not from this repo:
#    cd cms/worker && bunx wrangler d1 create tls-cms-chantal-masse   # + migrations, binding DB_CHANTAL_MASSE, R2 tls-cms, secrets
#    bunx wrangler deploy                                              # top-level Worker `tls-cms` (entrypoint SiteReads)
#    run the chantal import against the production D1 (#468's script, ported), then check
#    GET /v2/sites/chantal-masse/posts?locale=fr through the binding = 24 posts
# 1. Then the site:
CLOUDFLARE_ENV=production bun run astro:build          # picks env.production in astro/wrangler.jsonc
cd astro && bunx wrangler versions upload --message "Astro cutover <sha>"   # same Worker chantalmasse-website, same KV + secrets
bunx wrangler versions deploy <new-version-id>@100% --name chantalmasse-website
cd .. && bun scripts/parity-crawl.ts diff docs/migration-baseline/crawl.json https://chantalmasse.com   # must be 0 (+ accepted og:image)
bun scripts/check-urls.ts https://chantalmasse.com https://www.chantalmasse.com
# Rollback (seconds): bunx wrangler versions deploy d8f22b85-1835-471c-a323-686da909e2da@100% --name chantalmasse-website
```
The Nuxt version's static assets live in its own version, so a rollback serves them again. Keep `git tag nuxt-final` on the last Nuxt commit.

## Commands

- Preview deploy: `bun run astro:deploy:preview` · parity: `bun run parity` · smoke on preview: `bun run test:smoke:astro`
- Tracking probe used for the matrix: Playwright, hits to `google-analytics|doubleclick|google.com/ccm|facebook.com/tr` recorded and aborted (script in the PR description).
- `scripts/check-urls.ts` (with #54's same-origin open-redirect check): passes on the preview, like production.
