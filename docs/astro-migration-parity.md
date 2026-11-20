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
| Smoke suite (`tests/smoke`, 54 tests) against the preview | **53/54**; the failing one asserts Nuxt's CSS-first trick (no `<script src>` in HTML) |
| Unit/server tests, typecheck gate | 203/203; `typecheck: OK (39 known baseline errors, 0 new)` |
| Lighthouse | desktop ≥ baseline on all 5 URLs; mobile ≥ baseline on 2, = on 1, behind on `/prendre-rendez-vous` and `/` LCP (open items) |
| E2E in test mode (booking, newsletter, contact, blog publish) | **not run**: needs preview secrets and the CMS write token (see "What Jeremie needs to provide") |

**Cutover is not ready**: the blog reads the **staging** CMS and no production `tls-cms` exists yet (blocker 1 below).

## How it's built (and why)

- `astro/` next to Nuxt, sharing `package.json`, `public/` (incl. `_redirects`), `assets/css/main.css`, `server/`, `utils/`, `composables/useTracking.ts`. Nuxt files are unchanged except a one-line `typescript.tsConfig.exclude` so `nuxt typecheck` ignores `astro/`. Trigger.dev tasks and `trigger-deploy.yml` paths are unaffected.
- **API routes: the existing `server/api/*` handlers run unchanged** behind one h3 router (`astro/src/pages/api/[...path].ts`, globals in `astro/src/lib/nitro.ts`), the same way `tests/server/*` already exercises them. Zero handler rewrite = zero logic drift, and the existing server tests keep covering the code that ships. Error bodies keep Nitro's JSON shape byte for byte. Shims (`googleapis`, `twilio`) are the same Vite aliases.
- **Booking/contact/newsletter UI: kept as Vue islands** (`astro/src/vue/**`, copies with explicit imports). Rewriting the booking flow in vanilla TS was the plan's biggest risk; the islands pass the existing booking/contact smoke tests (mocked APIs, conversion assertions) unchanged. Static sections render without hydration; CTAs use `data-booking-open` / `data-contact-open` handled by `astro/src/lib/client.ts`. The modals are `client:only` (they Teleport to `<body>`, which SSR drops).
- **View transitions**: `<ClientRouter />` in `astro/src/layouts/Base.astro`; the Nuxt page veil runs on the ClientRouter lifecycle.
- **Page views on every in-site navigation**: verified against production. The Google tag and the Meta pixel count ClientRouter navigations with their own history listeners, exactly as under Nuxt's router (1 each); PostHog gets one `$pageview` per `astro:page-load` (PostHog is off on both today: no key baked at build). One trap found and fixed: ClientRouter parses the next page with scripting off, so the `<noscript>` pixel `<img>` fired an extra Meta PageView per navigation; it is now `transition:persist`.
- **SEO head**: `astro/src/lib/seo.ts` reproduces `@nuxtjs/seo` output (robots defaults, og:*, the Person/WebSite/WebPage graph). Kept on purpose for parity, fix after cutover: blog posts emit an **empty** `<meta name="description">` today (live bug), robots.txt keeps its `nuxt-robots` comment lines, 404 responses carry `X-Robots-Tag: index, follow…` like Nuxt.
- **URL shape**: `build.format: 'file'` + `trailingSlash: 'never'` + the same `_redirects` = same no-slash URLs and one-hop 301s.
- **Blog on the TLS CMS** (Jeremie's decision): companion PR **jaubut/tls-dashboard-v2#468** imports the 24 posts once into site `chantal-masse` (staging D1 `tls-cms-chantal-masse-staging`), with a coverage test, and adds "approve publishes via the CMS" behind `BLOG_PUBLISH_TARGET` (default stays `github`). The Astro blog (`/blog`, `/blog/<slug>`, the 2 latest posts on `/`, `/sitemap.xml`) reads it at request time through `astro/src/lib/cms-client.ts` over a service binding (`CMS` → `SiteReads`); media at `/media/<key>` (engine's `Image.src`). No rebuild per article.
- **CMS-backed pages are cached** (`astro/src/middleware.ts`): HTML in KV per path, keyed by Worker version (cached HTML points at that deploy's hashed assets), served at once and re-rendered in the background after 60 s, KV written only when the HTML changed. Without it, TTFB of `/blog` was 300+ ms of CMS I/O vs a prerendered Nuxt page. Media variants are cached in KV too (the engine doesn't cache its Images transforms; a hero waiting on one was the post LCP).
- Icons: `@iconify/vue` fetched `api.iconify.design` at runtime; `astro/src/icons.json` (generated, 41 icons) renders them at build time.
- Fonts: Astro Fonts API self-hosts Newsreader/Manrope like `@nuxtjs/google-fonts` did; no preload (preloading delayed FCP/LCP on mobile by ~1 s in measurements).
- Versions: astro 7.4.13, @astrojs/cloudflare 14.4.9, @astrojs/vue 7.1.6, wrangler 4.165.0 (new deps: these + `ofetch`, `@iconify-json/mdi`, `@iconify/utils`).

## Diffs that need Jeremie's sign-off

1. **`og:image` on the 24 posts** now points to the self-hosted CMS copy of the same picture (`https://chantalmasse.com/media/sites/chantal-masse/media/<sha>.jpg`) instead of the Wix/Unsplash hotlink. This is the CMS design (heroes in R2); keeping the external URL would need a contract change for a parity artifact. Recommendation: accept. Full list: `docs/migration-baseline/parity-diff-preview.txt`.
2. **Sitemap `<lastmod>`** (post date) added on posts: `content.config.ts` asked for it and `tests/smoke` expects it; the live Nuxt build drops it. `/__sitemap__/style.xsl` (cosmetic XSL) is gone.
3. **Post bodies**: 23/24 word-for-word identical to live. `apprendre-a-se-comprendre`: its table is a bullet list ("cell — cell"); 12 horizontal rules across 10 posts are dropped. The CMS contract has no `table` / `horizontalRule` node; PR #468 proposes the additive change.

## Lighthouse (mobile median of 3, Nuxt prod → Astro preview)

SEO score is lower on the preview only because of its deliberate `noindex` header (61–69 vs 92–100); a11y and best-practices are equal on every URL.

| URL | perf | FCP | LCP | TBT | CLS | weight |
|---|---|---|---|---|---|---|
| `/` | 63 → **64** | 1.61 → 1.98 s | 6.20 → 8.19 s | 310 → 294 ms | 0.009 → 0.024 | 2509 → 1783 KB |
| `/coaching-de-couple` | 84 → **84** | 1.61 → 1.55 s | 1.77 → 1.62 s | 507 → 414 ms | 0.012 → 0.111 | 790 → 715 KB |
| `/therapie-individuelle` | 80 → **86** | 1.63 → 1.37 s | 1.79 → 1.39 s | 604 → 426 ms | 0.004 → 0.025 | 790 → 715 KB |
| `/prendre-rendez-vous` | 56 → **51** | 1.62 → 2.94 s | 9.34 → 9.90 s | 545 → 622 ms | 0.001 → 0.001 | 1701 → 1631 KB |
| `/blog/l-amour-conscient` | 83 → **80** | 1.60 → 1.55 s | 3.27 → 3.13 s | 325 → 388 ms | 0.000 → 0.022 | 1067 → 896 KB |

Desktop (1 run): `/` 83 → 88, `/coaching-de-couple` 97 → 97, `/therapie-individuelle` 97 → 98, `/prendre-rendez-vous` 86 → 86, `/blog/l-amour-conscient` 97 → 98.
Raw numbers: `docs/migration-baseline/lighthouse.json` (before), `lighthouse-before-after.json`. Note: the preview is on workers.dev (no zone cache, HTTP/2), production on the zone; neither meets the plan's mobile ≥ 85 on `/` and `/prendre-rendez-vous` (baseline 63 and 56).

**Open perf items (not fixed in this PR):** `/prendre-rendez-vous` mobile FCP 2.9 s vs 1.6 s (the whole page is one `client:load` island; not yet diagnosed); `/` mobile LCP is a `data-animate` paragraph revealed by JS (7.2–8.2 s across runs vs 6.2 s); `/coaching-de-couple` CLS 0.11 on mobile (hero CTA row shifts on font swap; 0.02 when Manrope was preloaded, but that cost ~0.9 s FCP elsewhere).

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

1. **No production CMS.** `cms/worker/wrangler.jsonc` only deploys `--env staging`. Needed: a production `tls-cms` Worker with a `DB_CHANTAL_MASSE` D1, the 24-post import run against it (PR #468's script, pointed at prod), then `astro/wrangler.jsonc` `env.production.services` already names `tls-cms`/`SiteReads`.
2. **PR #468** merged, `bun scripts/apply-schema.ts` for the two new `blog_drafts` columns, and `BLOG_PUBLISH_TARGET=cms` only at cutover (the GitHub path stays live until then; after cutover a GitHub commit no longer publishes anything).
3. **E2E in test mode** (stage 4) once the preview has test secrets.
4. Sign-off on the 3 diff classes above and the open perf items.

## What Jeremie needs to provide (preview secrets, names only)

`wrangler secret put <NAME> --name chantalmasse-website-astro` for: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` (a **test** calendar shared with the service account), `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO` (Jeremie), `CHANTAL_MEET_LINK`, `NEWSLETTER_SITE_KEY`, `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE`. No Twilio on the preview. For the blog publish E2E: the dashboard deployed from PR #468 with `CMS_TOKEN_SECRET` and `BLOG_PUBLISH_TARGET=cms` on a staging dashboard.

## Cutover runbook (stage 5, only on « Deploy Chantal »)

```bash
# 1. Production CMS live with chantal-masse imported (blocker 1), then:
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
- `scripts/check-urls.ts` reports 3 `open-redirect` FAILs on **production too**: `//evil.com/` 301s to `/evil.com` on the same origin (safe), not to `/` as the script expects; preview behaves identically.
