# Deploy notes: www, sitemap noindex, trailing slash, blog go-live (2026-11-19)

Fixes the 4 live issues from `docs/astro-migration-plan.md` §1.1. Google Ads is live: every redirect below is one 301 that keeps the query string (`gclid`, `utm_*`, `fbclid`).

## What changes at deploy

| URL | Before | After |
|---|---|---|
| `/path` (every page except `/`, every post) | 307 → `/path/` | **200** |
| `/path/` | 200 | **301 → `/path`** (query kept) |
| 12 legacy `_redirects` sources (`?gclid=x&utm_source=y`) | 301 → `/coaching-de-couple/` etc. | 301 → `/coaching-de-couple` etc. (final URL, 200) |
| `/sitemap.xml` | 33 `<loc>` incl. noindex `/prendre-rendez-vous` | 32 `<loc>`, `/prendre-rendez-vous` removed (page stays `noindex`) |
| `https://www.chantalmasse.com/*` | 200 / 307 on www | 301 → `https://chantalmasse.com/*`, **needs the zone rules below** |

How: prerender emits `/journey.html` instead of `/journey/index.html` (`nitro.prerender.autoSubfolderIndex: false`), so Workers assets serve the no-slash URL, and `public/_redirects` ends with `/*/ /:splat 301`. Static `_redirects` rules are matched before that catch-all, so legacy slash URLs still go to their final page in one hop. Just before it, `//* / 301` sends any multi-slash path home: without it `//evil.com/` matched the catch-all and 301'd to `//evil.com` (open redirect). `check-urls.ts` checks it.

Ads final URLs and sitelinks that use `https://chantalmasse.com/prendre-rendez-vous/` (with a slash) now get one 301 to the no-slash URL instead of a 200. Ads allows same-domain redirects and the gclid is kept. Point them at the no-slash URL when you next edit the ads.

## 1. Manual release (this PR)

```bash
bun run build
bunx wrangler deploy --config .output/server/wrangler.json
bun scripts/check-urls.ts https://chantalmasse.com          # must end with all PASS
git tag -f site-deployed "$(git rev-parse HEAD)" && git push -f origin refs/tags/site-deployed
```

After **every** manual deploy, run the last line with the deployed commit. The blog workflow compares `main` against this tag (§3).

Rollback: `bunx wrangler rollback --name chantalmasse-website -m "reason"`.

## 2. www → apex: Cloudflare Single Redirect rules (zone `chantalmasse.com`)

This can't be done in the repo. `_redirects` only accepts relative sources, and the Worker never sees `www.chantalmasse.com/` because Workers assets answer first. Running the Worker first on every request would make every page view a Worker invocation. Redirect Rules run before the Worker and cost nothing.

Dashboard → chantalmasse.com → Rules → Redirect Rules → Single Redirects. Create these 6 in this order. All use **Status 301** and **Preserve query string: ON**. Each rule's expression excludes the others, so order doesn't matter, but keep it anyway.

Let `L` = `{"/coaching-relationnel-couple" "/coaching-relationnel-couple/" "/coaching-relationnel-de-couple-chantal" "/coaching-relationnel-de-couple-chantal/" "/therapie-individuelle-chantal" "/therapie-individuelle-chantal/" "/book-online" "/book-online/" "/booking-calendar" "/booking-calendar/" "/services" "/services/"}` (the static lines of `public/_redirects`).

| # | Name | When incoming requests match (expression) | URL (type) |
|---|---|---|---|
| 1 | www legacy couple | `(http.host eq "www.chantalmasse.com" and http.request.uri.path in {"/coaching-relationnel-couple" "/coaching-relationnel-couple/" "/coaching-relationnel-de-couple-chantal" "/coaching-relationnel-de-couple-chantal/"})` | Static: `https://chantalmasse.com/coaching-de-couple` |
| 2 | www legacy individuelle | `(http.host eq "www.chantalmasse.com" and http.request.uri.path in {"/therapie-individuelle-chantal" "/therapie-individuelle-chantal/"})` | Static: `https://chantalmasse.com/therapie-individuelle` |
| 3 | www legacy booking | `(http.host eq "www.chantalmasse.com" and http.request.uri.path in {"/book-online" "/book-online/" "/booking-calendar" "/booking-calendar/"})` | Static: `https://chantalmasse.com/` |
| 4 | www legacy services | `(http.host eq "www.chantalmasse.com" and http.request.uri.path in {"/services" "/services/"})` | Static: `https://chantalmasse.com/prendre-rendez-vous` |
| 5 | www trailing slash | `(http.host eq "www.chantalmasse.com" and http.request.uri.path wildcard r"/*/" and not http.request.uri.path in L)` | Dynamic: `wildcard_replace(http.request.uri.path, r"/*/", r"https://chantalmasse.com/${1}")` |
| 6 | www to apex | `(http.host eq "www.chantalmasse.com" and not http.request.uri.path wildcard r"/*/" and not http.request.uri.path in L)` | Dynamic: `concat("https://chantalmasse.com", http.request.uri.path)` |

Write `L` out in full in rules 5 and 6; the expression editor has no variables. Keep the `www` DNS record proxied (orange cloud). The Worker's www custom domain or route can stay; the redirect fires first.

Verify (www is checked only when the 2nd argument is given):

```bash
bun scripts/check-urls.ts https://chantalmasse.com https://www.chantalmasse.com
```

If a legacy line is added to `public/_redirects`, add it to rules 1–4 and to `L`.

## 3. Blog go-live: `.github/workflows/blog-deploy.yml`

Approved articles are committed to `main` by the dashboard (`content/blog/<slug>.md`). On a push to `main` that touches `content/blog/**` or `public/images/blog/**`:

1. **guard** runs on `main` only (a manual run from any other branch fails). If the pushed commit is already contained in `site-deployed` (re-run, or an older push queued behind a newer one) it stops green without deploying: it never deploys backwards. If `site-deployed` is not an ancestor of the pushed commit, it fails. Otherwise it runs `git -c core.quotePath=false diff --no-renames --name-only site-deployed <sha>` and fails if anything outside those two folders differs from the live deploy (`--no-renames` lists both sides of a rename; accented file names pass). That covers this push *and* any code merged earlier but not yet released. A failed guard is a red run, and the article waits for the next manual release, same as today.
2. **deploy** builds, checks `site-deployed` hasn't moved since the guard, runs `wrangler deploy` (pinned version), waits 20 s, then runs `scripts/check-urls.ts` against prod (new post 200 and in the sitemap, URL shape, no open redirect) plus `/api/booking/availability`. If it passes, it moves `site-deployed` forward with a lease on the value the guard checked.
3. **No automatic rollback.** If the smoke check fails, the new version stays live, the run fails red, `site-deployed` stays on the previous release, and the workflow opens a GitHub issue assigned to Jeremie with both options: `wrangler rollback`, or keep it and move the tag by hand. A Google Calendar outage during a blog deploy also lands here (the booking API check), which is why the decision stays human.

Code changes are never deployed by this workflow.

Setup (once):
- Repo secret **`CLOUDFLARE_API_TOKEN`**: an API token with *Workers Scripts: Edit* on the account that owns `chantalmasse-website`. Only the name appears in the workflow. If the token can see several accounts, also add the secret `CLOUDFLARE_ACCOUNT_ID` and pass it in the deploy step.
- Repo variable **`NUXT_PUBLIC_POSTHOG_KEY`** (public key, not a secret), if your manual builds set it. Prerendered pages bake it at build time.
- Server secrets are not needed in CI. The build bakes them as `""`, and the Worker's `NUXT_*` secrets override them at runtime. Before enabling, check that `bunx wrangler secret list --name chantalmasse-website` shows the `NUXT_GOOGLE_*`, `NUXT_RESEND_API_KEY`, `NUXT_EMAIL_*`, `NUXT_CHANTAL_MEET_LINK`, `NUXT_NEWSLETTER_*` and `NUXT_TWILIO_ACCOUNT_SID` / `NUXT_TWILIO_AUTH_TOKEN` / `NUXT_TWILIO_FROM_NUMBER` names. The smoke check doesn't exercise Twilio, so a missing one would go unnoticed.
- Create the `site-deployed` tag at the manual release (§1). Without it, the guard fails safely.
