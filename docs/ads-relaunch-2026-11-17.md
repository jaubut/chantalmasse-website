# Chantal Massé — approved Ads repairs and booking tracking

2026-11-17 · Customer **690-251-4931** · TLS manager **674-632-7196** · CAD

**Both Search campaigns are PAUSED. Nothing was enabled and SMART remains REMOVED.** The tracking PR must be deployed before launch. Payment-method validity and unpaid balance still need an authenticated Billing UI check.

Jeremie approved Couple $5/day and Individuelle $3.22/day, retained all ad copy and retained converting searches. No keywords, negative keywords, headlines, descriptions, sitelink labels or sitelink descriptions changed. Resource-keyed before/after comparisons confirm this across all 14 ads, 23 sitelink assets, 96 ad-group keyword rows, campaign negatives and 15 shared negatives.

## Applied Google Ads changes

All writes were validated before execution and read back afterward. The [append-only operation log](ads-relaunch-2026-11-17-changes.jsonl) records each request, validation, result and failed validation; a failed validation made no account change. Full local before/after evidence: `/tmp/chantal-ads-relaunch-20261117/`.

| Setting | Thérapie couple `21861912603` | Thérapie individuelle `21866233181` |
|---|---|---|
| Status | ENABLED/expired → PAUSED | ENABLED/expired → PAUSED |
| Daily budget | shared $8.22 → dedicated $5.00 | shared $8.22 → dedicated $3.22 |
| New budget ID | `16034557880` | `16034558051` |
| End date | June 30, 2026 → cleared/indefinite | June 30, 2026 → cleared/indefinite |
| Networks | Google Search only; partners and Display disabled | Google Search only; partners and Display disabled |
| Bidding | Maximize conversions → Maximize clicks, $1.50 cap | Maximize conversions → Maximize clicks, $1.50 cap |
| Language | French retained | French retained |
| Schedule | unrestricted → daily 06:00–22:00 America/Toronto | unrestricted → daily 06:00–22:00 America/Toronto |
| Geography | 40 km + location target → 30 km radius only | 40 km + location target → 30 km radius only |
| Geo intent | Presence retained | Presence-or-interest → Presence |

- Paused ad group **Coaching relationnel couple** (`170304164363`). Other ad-group statuses retained.
- Removed each campaign’s positive location target `9105286` and old 40 km radius; created one 30 km radius per campaign. Preserved the existing Shefford center **45.345273, -72.571197** and existing location exclusions. Created seven daily schedule criteria per campaign.
- Old shared budget `15573208229` remains unattached; no remaining campaign uses it. Combined daily budget $8.22 × Google's 30.4 convention = **$249.89/month before tax**. [Google budget documentation](https://support.google.com/google-ads/answer/1704424).
- Removed Individual campaign association for obsolete “Position” asset `180780078657` (`/post/estime-de-soi`). Removed the already-paused account-level “Appel Exploratoire” association `305865341888` (`/appel-exploratoire`).
- Updated **21 sitelink assets**, preserving wording, to canonical HTTPS URLs. `/services` and `/book-online` now point to booking; “À propos de Chantal” links now point to `/#apropos` instead of `/journey`. All **27 enabled associations outside removed SMART** have valid destinations. Replacement pages returned HTTP 200; the live bio anchor exists.
- Updated all **13 nonremoved Search ads** to the exact requested final URLs below. No mobile final URL override exists. Ad IDs and copy were retained.
- The removed SMART campaign and its historical ad were not restored or edited. Its historical HTTP ad URL and obsolete link association are retained on the removed campaign: Google rejects mutation of that removed campaign association. They cannot serve. All destinations that can serve in the two Search campaigns are HTTPS.

### Booking and contact conversions

- Created **Rendez-vous réservé**, ID `7906955419`, type `WEBPAGE`, category `BOOK_APPOINTMENT`, **primary**, one per click, dynamic CAD value. Exact public destination: `AW-16485477025/IFK1CJuhqrodEKHV8bQ9`.
- Renamed imported `generate_lead` action `7579925411` to **Contact** and made it **secondary**. Its existing `SUBMIT_LEAD_FORM` category remains: Google rejected a category change for its newer `GOOGLE_ANALYTICS_4_GENERATE_LEAD` type; name and primary-status changes succeeded. No additional Contact action was created, avoiding duplicate imports.
- Made legacy form action `6918505399` secondary while preserving its **REMOVED** status.
- Both Search campaigns now have exactly one biddable goal: `BOOK_APPOINTMENT / WEBSITE`. The former `SUBMIT_LEAD_FORM / WEBSITE` and `PHONE_CALL_LEAD / CALL_FROM_ADS` goals were set non-biddable in both campaigns (four changes). No custom goal is configured. The new booking goal was already biddable after creation and verified.
- Google tag configuration already loads linked `AW-16485477025`; no new global tag or GA4 import is needed. The code emits `booking_confirmed` and the direct Ads booking action only after successful calendar creation. Contact continues emitting `generate_lead`. Ads uses the confirmed calendar event ID as `transaction_id`; no contact data or cancellation token is sent. Meta Schedule dedup and PostHog booking funnel remain intact.
- Historical `generate_lead` data mixes bookings and contacts. The split begins with deployment; no historical records were rewritten.

## Payment status

**Payment method: UNVERIFIED. Unpaid balance: UNVERIFIED.** API confirms account ENABLED, billing setup APPROVED and account budget APPROVED, with indefinite billing periods. These statuses do not establish card validity or zero balance. Invoice query returned `403 DEVELOPER_TOKEN_NOT_APPROVED` (Explorer Access restriction). The billing UI redirects to sign-in; no authenticated browser session was available. No card/payment-instrument details were collected or reported. [Google billing API](https://developers.google.com/google-ads/api/docs/billing/overview).

Before launch, an authenticated operator must check customer **690-251-4931 → Billing → Summary and Payment methods**, and resolve any unpaid balance or invalid method.

## Send-day command

After this PR is deployed, billing is verified, and the brain authorizes the newsletter send day, run from this repository:

```bash
python3 scripts/ads-relaunch.py --enable --commit
```

This enables exactly the two approved Search campaigns in one API batch with `partialFailure: false`. It checks account/timezone, paused state, budget amounts, networks, bidding, language, schedule, geography, URLs, conversion goals, and the excluded group/SMART state first, then verifies again after mutation. It stops on drift. It does not verify payment validity or deployment automatically; those remain launch prerequisites above.

Default invocation and `--enable` without `--commit` are read-only. `--commit` alone is rejected. It uses existing TLS credentials without printing them, prioritizes environment values, and logs activation to `~/.local/state/tls/chantal-ads-activation.jsonl` (override with `--log`). The activation command was **not executed** during this work.

## Verification and deployment handoff

- Fresh Ads reads and read-only activation preflight pass; both campaigns remain PAUSED. Copy/keyword comparisons pass; SMART is unchanged.
- Unit/server tests: **182 passed**. Typecheck: **zero new errors**, 39 existing baseline errors.
- Production node-server and Cloudflare Worker builds passed under Node 24 (same major as CI). Local Node 22 stalled during Nuxt startup; no source workaround or dependency change was made.
- Review: no blocking implementation findings. The activation script now explicitly warns that campaigns may be live if post-submission verification fails. Offline activation tests cover valid preflight, nine drift rejections, read-only/invalid flags, atomic activation and the uncertain-response path; no real activation request was sent.
- Mobile static audit: no introduced regression; existing 36px back/close controls remain below the touch-target guideline. Real iOS keyboard/notch behavior remains a manual-device check. Browser: **51/51 passed**, including success/failure/contact separation at 390px and 1440px. No overflow; input text 16px; Enter submits; main submit target 68px tall. Modal bounds remain inside the viewport. Chromium cannot establish physical iOS keyboard/notch behavior.
- Isolated browser tests intercept calendar creation and external analytics, exercising real UI success/failure without a fake calendar appointment or synthetic conversion sent to Google. These tests prove emission, not production ingestion.
- After deployment, check the next genuine booking with Tag Assistant/GA4 DebugView or Realtime: one `booking_confirmed`, one Ads event with the destination above and the confirmed transaction ID, and no booking `generate_lead`. A genuine contact submission should produce `generate_lead` only and no booking conversion. Confirm the booking action's diagnostics after ingestion. Ads attribution requires an eligible prior ad interaction and may be delayed; do not click an ad or manufacture a booking to test attribution.
- Newsletter traffic retains the existing `utm_source=infolettre` tagging.

## Exact destination changes

### Sitelink assets

| Asset ID / unchanged label | Before | After |
|---|---|---|
| `180780078654` — Contact | https://www.chantalmasse.com/services | https://chantalmasse.com/prendre-rendez-vous/ |
| `181081883424` — Contactez-moi | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `181088490826` — Prenez un Rendez-vous | https://www.chantalmasse.com/book-online | https://chantalmasse.com/prendre-rendez-vous/ |
| `181088490829` — A propos | https://www.chantalmasse.com/#apropos | https://chantalmasse.com/#apropos |
| `181088490832` — Mes service | https://www.chantalmasse.com | https://chantalmasse.com/ |
| `266549804534` — A propos | https://www.chantalmasse.com/#apropos | https://chantalmasse.com/#apropos |
| `266549804537` — Coaching de couple | https://www.chantalmasse.com/coaching-relationnel-couple | https://chantalmasse.com/coaching-relationnel-couple/ |
| `266549804540` — Blogue | https://www.chantalmasse.com/blog | https://chantalmasse.com/blog/ |
| `266549804543` — Contact | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `352939034248` — Prendre rendez-vous | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `352939034251` — Thérapie individuelle | https://www.chantalmasse.com/therapie-individuelle | https://chantalmasse.com/therapie-individuelle/ |
| `352939034254` — Shefford ou en visio | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `352939034257` — À propos de Chantal | https://www.chantalmasse.com/journey | https://chantalmasse.com/#apropos |
| `352939034260` — Tarifs & assurances | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `352939034263` — Questions fréquentes | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `352939034266` — Prendre rendez-vous | https://www.chantalmasse.com/prendre-rendez-vous?service=couple | https://chantalmasse.com/prendre-rendez-vous/?service=couple |
| `352939034269` — Coaching de couple | https://www.chantalmasse.com/coaching-de-couple | https://chantalmasse.com/coaching-de-couple/ |
| `352939034272` — Shefford ou en visio | https://www.chantalmasse.com/coaching-de-couple | https://chantalmasse.com/coaching-de-couple/ |
| `352939034275` — À propos de Chantal | https://www.chantalmasse.com/journey | https://chantalmasse.com/#apropos |
| `352939034278` — Tarifs & assurances | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `352939034281` — Questions fréquentes | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |

### Search ads

| Ad ID | Campaign | Before | After |
|---|---|---|---|
| `719512327431` | Individuelle | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `719605244382` | Couple | https://www.chantalmasse.com/coaching-de-couple | https://chantalmasse.com/prendre-rendez-vous/?service=couple |
| `721760717035` | Individuelle | https://www.chantalmasse.com/therapie-individuelle | https://chantalmasse.com/prendre-rendez-vous/ |
| `721762234747` | Couple | https://www.chantalmasse.com/coaching-de-couple | https://chantalmasse.com/prendre-rendez-vous/?service=couple |
| `754002629934` | Individuelle | https://www.chantalmasse.com/therapie-individuelle | https://chantalmasse.com/prendre-rendez-vous/ |
| `754034261017` | Individuelle | https://www.chantalmasse.com/therapie-individuelle | https://chantalmasse.com/prendre-rendez-vous/ |
| `754123406843` | Couple | https://www.chantalmasse.com/coaching-de-couple | https://chantalmasse.com/prendre-rendez-vous/?service=couple |
| `755663277340` | Individuelle | https://www.chantalmasse.com/therapie-individuelle | https://chantalmasse.com/prendre-rendez-vous/ |
| `755663627515` | Individuelle | https://www.chantalmasse.com/therapie-individuelle | https://chantalmasse.com/prendre-rendez-vous/ |
| `755663809423` | Couple | https://www.chantalmasse.com/coaching-de-couple | https://chantalmasse.com/prendre-rendez-vous/?service=couple |
| `755749268858` | Couple | https://www.chantalmasse.com/coaching-de-couple | https://chantalmasse.com/prendre-rendez-vous/?service=couple |
| `812403263749` | Individuelle | https://www.chantalmasse.com/prendre-rendez-vous | https://chantalmasse.com/prendre-rendez-vous/ |
| `812403263881` | Individuelle | https://www.chantalmasse.com/therapie-individuelle | https://chantalmasse.com/prendre-rendez-vous/ |
