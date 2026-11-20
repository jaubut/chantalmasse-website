# STATE — Chantal Massé website

Last updated: 2026-11-20

## Astro migration, stages 0–4 — 2026-11-20 (preview only, live untouched)

- Astro 7.4 build in `astro/` next to Nuxt; preview Worker `chantalmasse-website-astro` (workers.dev, noindex). Report, blockers, cutover/rollback runbook: `docs/astro-migration-parity.md`. Baseline (crawl, Lighthouse, rollback version `d8f22b85`): `docs/migration-baseline/`.
- Parity: 0 crawl diffs except `og:image` on the 24 posts (self-hosted CMS copy), API errors byte-identical, tracking counts identical incl. ClientRouter navigations, smoke 53/54.
- Blog reads the TLS CMS (site `chantal-masse`, **staging** engine) via `cms-client`; import + publish-via-CMS in jaubut/tls-dashboard-v2#468 (`BLOG_PUBLISH_TARGET` default `github`).
- Blocked on: production `tls-cms` + import, preview test secrets for booking/newsletter E2E, Jeremie's sign-off. Cutover only on « Deploy Chantal ».
- Second pass (2026-11-20): mobile Lighthouse ≥ Nuxt on all 5 URLs (CSS-first scripts, inline intro/reveal, resized hero, per-page italic preload), PR review findings fixed, smoke 54/54. CMS moved to jaubut/tls-portal-cms: production `tls-cms` deploys from there; it predates tls-dashboard-v2#468 (Chantal importer + `DB_CHANTAL_MASSE` + publish-via-CMS must be ported there). Preview secrets list: report §« What Jeremie needs to provide ».
- Gotchas: `server/api/*` run unchanged through h3 (`astro/src/lib/nitro.ts`), keep them framework-free of new Nitro auto-imports; the `<noscript>` pixel must stay `transition:persist` (else +1 Meta PageView per navigation); the HTML cache key includes the Worker version id.

## URL fixes — 2026-11-19 (not deployed)

- No-slash URLs are canonical: `/path` 200, `/path/` 301 → `/path` (query kept); `/prendre-rendez-vous` out of the sitemap; legacy `_redirects` go to the final URL in one hop. Check: `bun scripts/check-urls.ts <base> [www-base]`.
- Open, by hand: www → apex Cloudflare Redirect Rules, `site-deployed` tag after every manual deploy, repo secret `CLOUDFLARE_API_TOKEN` for `.github/workflows/blog-deploy.yml` (blog-only auto-deploy, main-only, no automatic rollback: a failed smoke opens an issue). Steps: `docs/url-fixes-deploy-notes.md`.

## Booking production QA — 2026-11-17 (Ads live)

- Live Worker was `321e9eb` (#45): #46 and #47 merged but not deployed. Deploys are manual (`bun run build` + `wrangler versions upload/deploy`), not Vercel.
- Fixed in `fix/booking-prod-qa-2026-11-17`: availability/create exceeded Worker CPU (Cloudflare 1102, ~40% of calls; p99 867 ms → 57 ms); cancel link 503 (shim lacked `events.delete`); legacy meta-refresh stubs dropped gclid/utm (now `_redirects` 301s); silent empty calendar on error; native validation hid French messages; couple slots advertised video; 36px controls; FAQ price; client emails had no reply-to; booking copy in tu.
- Open: Meta CAPI secrets (`META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`) missing on the Worker; prerendered pages bake an empty PostHog key unless `NUXT_PUBLIC_POSTHOG_KEY` is set at build time.

## Change Plans

### Change Plan — ads-relaunch-booking-conversion (2026-11-17)
**Request:** Apply Jeremie's approved Ads relaunch repairs with campaigns paused; separate successful calendar bookings from contact leads, deliver a tracking PR, report billing status and provide one send-day enable command. Ad copy and negatives stay unchanged.
**Authorization:** User explicitly approved the implementation, account mutations and PR. Campaign activation and production deployment are not authorized today.
**Done when:** Fresh Ads reads prove the approved settings and PAUSED state; successful booking emits `booking_confirmed` plus the primary Ads booking action, contact emits only its secondary lead signal; isolated browser tests prove success/error separation without real calendar or analytics writes; PR and mutation report contain evidence.

**Target shape & drift**
- Reference: [Google conversion measurement](https://developers.google.com/tag-platform/devguides/conversions) separates an Ads conversion action/destination from the GA4 event; [transaction IDs](https://support.google.com/google-ads/answer/6386790) deduplicate a confirmed business action. Here, calendar success → booking event + Ads destination; contact success → lead event.
- Google Calendar remains the booking system of record. The server owns appointment creation; the browser observes the successful response and the tracking composable owns analytics side effects.
- One business event maps to one primary Ads conversion. The GA4 event remains useful independently; it must not also be imported as a second primary booking conversion.
- Current drift: booking and contact share `generate_lead`; the modal treats every resolved response as success; the existing Google tag already loads its linked Ads destination. Correct event separation and the success guard only. No server-side analytics, consent redesign, dependency upgrades or broader telemetry work in this scope.

**State decisions**
- `BookingModal` owns submission/result state. Require `result.success === true` and a nonempty calendar `eventId` before confirmation and conversion; no new persistent state.
- Preserve the existing client `metaEventId` as the third tracking argument for Pixel/CAPI dedup. Add the server booking ID as a fourth argument for Ads `transaction_id`; it contains no contact details or cancellation token.
- Keep the public, nonsecret booking destination `AW-16485477025/IFK1CJuhqrodEKHV8bQ9` in client source; action `customers/6902514931/conversionActions/7906955419` is WEBPAGE / BOOK_APPOINTMENT / primary / ONE_PER_CLICK. Existing GA4-linked configuration already loads this Ads destination; preserve head initialization and newsletter confirmation-page exclusion unchanged.
- Booking sends `booking_confirmed` to GA4 and a direct `conversion` only to the returned `AW-…/label`. It no longer sends `generate_lead`. Contact keeps `generate_lead`, whose existing imported action `7579925411` becomes secondary `Contact` (existing SUBMIT_LEAD_FORM category; Google rejects changing the category of this newer GA4 lead type); removed legacy actions remain removed/secondary.
- Existing Meta `Schedule` + event ID and PostHog `booking_completed` remain intact. Booking payloads, API endpoints, and appointment side effects stay unchanged.
- Root owns account mutations through temporary scripts and an append-only before/operation/result log. The durable `scripts/ads-relaunch.py` defaults to read/dry-run; `--enable --commit` performs the single send-day activation only after preflight. It identifies customer 6902514931 and manager 6746327196 and constrains target campaign IDs.

**Contracts touched** (map regenerated 2026-11-17; lint: 0 blocking, one unrelated legacy cap warning)
| contract | kind | change | consumers / callers | compat |
|---|---|---|---|---|
| `useTracking().trackBookingComplete(service, value, eventId, bookingId?)` and caller success boundary | export / event | additive booking ID; replace booking `generate_lead` with `booking_confirmed`; direct Ads booking conversion only after `success === true` + confirmed event ID | `components/booking/BookingModal.vue:308`; external GA4/Ads; existing Meta and PostHog | JS API additive; intentional analytics semantic migration with old Ads lead action secondary |
| `useTracking().trackContactSubmit()` | export / event | none; preserve contact-only `generate_lead` | `components/ContactModal.vue:137`; imported GA4 Ads action | unchanged client contract; Ads primary flag/name changes |
| `POST /api/booking/create` | endpoint | none; client validates existing success/eventId fields before conversion | map: `components/booking/BookingModal.vue`; tests | unchanged wire contract |
| `useTracking().trackEvent()` | export | none | map: `pages/prendre-rendez-vous.vue`; booking/contact helpers | unchanged; CTA and service-switch events remain |
| Ads relaunch CLI | operational command | NEW: read/preflight and explicit `--enable --commit`, mutation log | root/operator; user’s send-day command | new operator-only CLI; not invoked to enable today |

**Files — one owner each**
| file | owner | change | cap check |
|---|---|---|---|
| `composables/useTracking.ts` | tracking worker | separate booking GA4 event, direct Ads tag with transaction ID, preserve Meta/PostHog | 124 → ~145, below 600 |
| `components/booking/BookingModal.vue` | tracking worker | validate successful response; pass confirmed ID; use narrow error handling if touching catch | 406 → ~420, below 600 |
| `tests/unit/tracking.test.ts` | tracking worker | NEW: no exports; GA4/Ads isolation, transaction ID, Meta dedup, browser-absent behavior | new, below 600 |
| `tests/smoke/booking.spec.ts` | tracking worker | capture dataLayer for successful/failed/false-success booking, no premature event | 167 → ~235, below 600 |
| `tests/smoke/forms.spec.ts` | tracking worker | assert contact success generates contact lead without booking conversion | existing, below 600 |
| `scripts/ads-relaunch.py` | root | NEW: no library exports; audited API reads/mutations and guarded send-day enable command | new, target below 600 |
| `docs/ads-relaunch-2026-11-17.md`, `docs/ads-relaunch-2026-11-17-changes.jsonl` | root | NEW: no exports; approved changes, sanitized mutation log, billing status, activation command, deploy verification | documentation/data |
| `architecture.json`, `architecture.md` | root | regenerate after implementation | generated |
| `STATE.md` | tracking_plan then root | this plan, analyst reconciliation, verification and PR handoff | plan below 120 lines |

**Fan-in paths to guard**
- `useTracking` is shared by BookingModal, ContactModal and the booking landing page. Do not change CTA/start/contact semantics while replacing only the successful-booking signal.
- Ads conversion uses a direct `window.gtag` call, not the generic helper, so Ads-only `conversion`/`send_to` is not mirrored to Meta/PostHog.
- Booking API success precedes all confirmation/tracking. Validation errors, HTTP errors, `success:false`, modal opening, service/date selection and contact submission emit no booking conversion.
- Preserve Meta Pixel/CAPI identity: server request `metaEventId` equals Pixel Schedule `eventID`; Ads transaction identity uses confirmed booking ID independently.
- Existing Google head configuration and the `/confirmer-inscription` exclusion remain unchanged. Browser smoke confirms tracking is still available on the booking page.

**Risks**
- Map blind spot: `useTracking` fan-in is mapped, but returned helper invocations and external analytics destinations are not separate edges. Their consumers above were source-confirmed; no shared adapter changes authorized here.
- KB queries for posthog-js, Nuxt and google-ads-api completed. Nuxt shared module state is unsafe across SSR requests → add no module-level visitor/booking state (kb: `agent://senior-dev/vue-nuxt/2026-09-04`; no dependency advice relied on). Other hits do not require changes for this scope.
- Old deployed code continues sending bookings as `generate_lead` until PR deployment. Keep campaigns paused; report deployment as outstanding and make the send-day prerequisite explicit.
- Local intercepted tests prove browser behavior, not Google ingestion or an attributable Ads booking. After deployment observe the next genuine booking in GA4/Ads diagnostics; do not manufacture a calendar appointment or click an ad.
- Billing API approval alone does not establish current payment-method validity or unpaid balance. Report only verified status; never payment instrument details.

**Verify**
1. Unit tests assert booking GA4 name, exact Ads `send_to`, CAD/value/transaction ID, no booking `generate_lead`, contact isolation and preserved Meta/PostHog signals; no real network.
2. Browser smoke with external requests intercepted: before submit no booking event; confirmed success emits once with the returned ID; HTTP refusal and a 2xx unsuccessful response emit none; contact emits only `generate_lead` and no booking Ads conversion.
3. Browser mobile/desktop check: booking dialog still usable, no overflow/console errors; keyboard focus, touch targets, safe-area layout and input zoom retain existing behavior. Run mobile audit.
4. Run unit/server suite, typecheck against existing baseline, production build and relevant browser smoke; inspect diff, regenerate map and run lint.
5. Root verifies every Ads mutation through fresh queries: budget split, URLs/sitelinks, excluded group, networks/language/bidding/time/geo/end date, conversion goals, two PAUSED campaigns and SMART REMOVED. Compare all ad copy and negatives to pre-change snapshots.
6. Review and drift check against this plan; PR includes final tables and evidence. Test enable command in dry-run only; never execute enable today.
7. Jeremie’s pre-launch manual pass after deployment: open booking flow and confirm unchanged usability; on the next genuine booking inspect `booking_confirmed` and the direct booking action (separate from Contact), then authorize/use the one send-day command. Account delivery and production ingestion are not claimed by local preview evidence.

**Analyst findings — reconciled 2026-11-17**
- Tracking analyst confirmed the sole completion caller and additive fourth argument. Analytics semantics deliberately change; contact migration and paused campaigns cover it. Require confirmed ID for the direct Ads conversion; keep Ads-only events out of the Meta/PostHog mirror and preserve server CAPI identity.
- Operational analyst confirmed no existing CLI consumers. Missing campaigns fail closed; environment credentials override files; preflight checks campaign/custom goals; both status changes use one non-partial batch and are verified after. Default and `--enable` alone are read-only; `--commit` alone is invalid. Deployment and billing remain explicit prerequisites.
- Live API diagnosis: current generate_lead action type is GOOGLE_ANALYTICS_4_GENERATE_LEAD in v26 (UNKNOWN in v23). Name and primary flag are mutable; category change returns request error 138. Retain its existing category while renaming Contact and making it secondary. The requested behavior is preserved.

**Verification results — 2026-11-17**
- 182/182 unit/server tests; 51/51 Chromium smoke tests; typecheck: zero new errors (39 baseline). Node-server and Cloudflare Worker production builds pass under Node 24, matching CI; local Node 22 stalled without source changes.
- Success, HTTP failure, unsuccessful 2xx and missing/empty booking ID paths are browser-tested with intercepted APIs/analytics. Contact produces only its lead event. No calendar appointments or synthetic Google conversions were created.
- Mobile/desktop 390/1440: no overflow/console errors, 16px inputs, 68px submit target, Enter submission; existing 36px back/close targets unchanged. Physical iOS keyboard/notch remains a manual check.
- Fresh Ads reads and default/--enable dry runs pass: both campaigns PAUSED; budgets $5/$3.22; exact settings/URLs and booking-only biddable goals. Resource-keyed ad/sitelink-copy, keyword and negative comparisons pass; SMART unchanged. Log: 16 applied batches, four rejected validations, no enable operation.
- Offline CLI verification: nine drift rejections, no-mutation flags, atomic fake activation/readback, explicit uncertain-submission warning. Delivery review: no remaining implementation blocker; mobile audit: no introduced regression; archmap: zero blockers, one legacy cap warning.
- Payment method and unpaid balance unverified (invoice API Explorer restriction, no authenticated UI). Deployment, genuine booking ingestion and newsletter-day activation remain outside this PR's completed implementation.

**Out of scope:** Ad-copy edits, new negatives, enabling campaigns now, SMART restoration, production deployment/merge, fake bookings, messages to clients, broader analytics or dependency refactoring.

### Change Plan — pr45-cloudflare-newsletter-continuation (2026-11-16)
**Request:** Finish PR #45 from `b5dc2aac`: Cloudflare deployment/runtime bindings, `https://dashboard.apies.dev`, approved consent/privacy copy, fix the failed CI, commit/push and wait for the final CI result.
**Authorization:** Jeremie explicitly authorized this continuation, commit and push. Production merge/deployment is separate.
**Done when:** The Cloudflare build runs both newsletter routes with runtime-only bindings; confirmation works after hydration and only submits on click; the pushed head has a completed `ci` result and accurate PR evidence.

**Target shape & drift**
- Reference: [Nuxt runtime config](https://nuxt.com/docs/4.x/guide/going-further/runtime-config) and [Nitro Cloudflare Workers](https://nitro.build/deploy/providers/cloudflare): private config → per-request route config; generated Worker → Workers runtime; prerendered HTML → client hydration.
- The browser owns confirmation UI state; the dashboard owns subscriber/consent persistence; only Worker routes send the site key upstream.
- Existing shape already follows this split. Drift: Cloud Run URL/default documentation, leftover Vercel deploy configuration, an uncommitted Brevo example, and failing fragment-based confirmation UI.
- Correct those paths only. Existing booking implementation, unrelated typecheck baseline and dashboard retention purge remain outside this continuation.

**State decisions**
- Runtime secrets remain on Worker `chantalmasse-website`; both plain and `NUXT_` newsletter names are already configured. Do not rotate or print them.
- Declare `newsletterApiBase` and `newsletterSiteKey` in private runtimeConfig, with serializable defaults; consume via `useRuntimeConfig(event)`. `NUXT_NEWSLETTER_*` overrides apply after build.
- Confirmation token and status remain page-local; no persistence or automatic POST. Nuxt temporarily removes the fragment during deferred-route hydration; capture `router.currentRoute.value.hash` in `onNuxtReady`, then clear it through `router.replace`. Preserve response/error behavior and the approved consent literal `2026-11-v1`.

**Contracts touched** (architecture map regenerated by parent on 2026-11-16; lint: 0 blocking, one unrelated legacy cap warning)
| contract | kind | change | consumers / callers | compat |
|---|---|---|---|---|
| `runtimeConfig.newsletterApiBase/newsletterSiteKey` | private config | correct default URL and ensure runtime declaration | `server/utils/newsletterApi.ts` → both newsletter handlers | compatible |
| `callNewsletterApi(event, path, body)` | export | none unless runtime verification reveals a defect | `server/api/newsletter/{subscribe,confirm}.post.ts` | unchanged |
| `POST /api/newsletter/subscribe` | endpoint | none; verify Workers execution | `components/NewsletterSection.vue`, `pages/blog/[slug].vue` | unchanged |
| `POST /api/newsletter/confirm` | endpoint | none; verify Workers execution | `pages/confirmer-inscription.vue` | unchanged |
| `/confirmer-inscription#t=…` | browser page | restore functioning hydration/token handling | confirmation email; `tests/smoke/forms.spec.ts` | compatible bug fix |
| `NEWSLETTER_CONSENT_TEXT` | export | none; approval removes draft status only | home form, blog form, privacy page | unchanged |
| Cloudflare build/deploy artifact | deployment | remove obsolete Vercel configuration; document generated Wrangler config | Cloudflare Worker build, CI production-build step | Cloudflare remains target |

**Files — one owner each**
| file | owner | change | cap check |
|---|---|---|---|
| `nuxt.config.ts` | root | API origin, explicit runtime defaults | 186 → ~190, below 600 |
| `.env.example`, `.claude/CLAUDE.md`, `ORCHESTRATOR.md`, `README.booking.md`, `TESTING.md` | root | align examples, bindings, deployment and verification | docs/config, bounded edits |
| `vercel.json`, `.gitignore` | root | remove obsolete deploy config; ignore generated Wrangler state | bounded edits |
| `pages/confirmer-inscription.vue`, `tests/smoke/forms.spec.ts` | root | diagnosed browser fix and regression coverage | 83/146 lines, below 600 |
| `plugins/posthog.client.ts`, `nuxt.config.ts` analytics entries | root | review finding: exclude token-bearing confirmation page before tracking starts | bounded privacy fix |
| `tests/setup/no-network.ts` | root | scrub prefixed newsletter test secrets | below 600 |
| `architecture.json`, `architecture.md` | root | regenerate after final implementation | generated |
| `STATE.md` | continuation_plan, then root after handoff | this plan and verification progress | below 80 lines |
| PR #45 body | root | actual binding state, approval, diagnosed failure and final evidence | external metadata |

**Fan-in paths to guard**
- Both handlers share `callNewsletterApi`: Origin validation, Cloudflare IP precedence, site-key secrecy, timeout and status mapping must hold for both.
- Consent is shared by both forms and the notice: do not edit approved wording or change its version.
- Deployment config affects every route: preserve shims, prerender rules and `nodejs_compat`; browser smoke uses the separate `node-server` build.

**Risks**
- An undefined key may disappear during config serialization: verify runtime-only `NUXT_NEWSLETTER_SITE_KEY` after a build with no key present.
- Node smoke alone cannot prove Workers compatibility: exercise the generated Worker locally using dummy secrets and an isolated upstream.
- A confirmation token in URL/analytics or a mount-time POST breaks the privacy/click-only intent; inspect browser requests and history during the fix.
- KB queries for Nuxt/h3 completed but returned no applicable package guidance. Installed Nuxt/Nitro code and official docs are the reference.
- Map blind spot: runtime config reads and test/email callers are not mapped as edges; callers above are source-confirmed. No map tooling edits in this task.

**Verify**
1. `gh run view 43874947576 --log-failed`: new confirmation test cannot find the button. Root traced Nuxt 4.6.1 `hasDeferredRoute`: URL loses its hash before page mount and restores it at `app:suspense:resolve`, after the page has selected the invalid state.
2. Baseline evidence: [main run 43665383066](https://github.com/jaubut/chantalmasse-website/actions/runs/43665383066) fails quoted YAML slug parsing in the sitemap test; PR #45 already contains that fix. Do not attribute the confirmation failure to main.
3. Unit/server tests and typecheck pass against the existing baseline; Cloudflare production build emits the expected Worker/config.
4. Exercise subscribe and confirm in Workers with runtime-only dummy bindings; assert URL/headers/body, allowed Origin, rejected Origin and error mapping without real mail.
5. Browser smoke: capture token after hydration and clear URL before click; no POST before click; confirmed, opted-out, invalid and retry states behave correctly. Check mobile targets, overflow, focus and errors without changing approved copy.
6. Inspect the diff, run review, regenerate the map, update PR evidence, commit/push, then poll `ci` for that exact head to completion.
7. Before production merge, Jeremie manually checks the live email → confirm button → success flow and dashboard subscriber record. This is a release check, not a blocker for the authorized PR continuation.

**Out of scope:** Production deployment, secret changes, Vercel account disconnection, dashboard retention jobs, new UI design and unrelated baseline cleanup.

## Verification results — 2026-11-16
- 174/174 unit/server tests; typecheck: 0 new errors (39 baseline); 47/47 Playwright smoke tests. The new confirmation regression fails against the original build and passes after the hydration fix.
- Cloudflare build passed. Miniflare/workerd executed both routes with runtime-only dummy NUXT bindings and isolated outbound fetch: forwarding, all confirm results, Origin/input rejection, status mapping, missing-binding 503 all passed.
- Browser checks at 390×844 and 1440×900: no overflow, 56px confirmation targets, no JS errors; approved notice has no DRAFT. With a dummy PostHog key injected, the confirmation entry page emits no analytics requests.
- Review: no blocker; mobile audit has no critical/high finding. Existing consent text links are ~36px high (medium; unchanged markup); confirmation controls pass. Archmap lint: 0 blocking, one unrelated legacy cap warning.
- Pushed head and final CI result are recorded in PR #45; production email delivery/dashboard persistence remain a post-deployment check.
