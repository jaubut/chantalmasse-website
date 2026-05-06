// Google Ads audit — campaigns, ad groups, geo, devices, search terms.
// Paired with scripts/ga4-audit.ts (conversion-side) — this one is the
// spend/impression side.
//
// Env vars required (add to .env before running):
//   GOOGLE_ADS_DEVELOPER_TOKEN      — from MCC → Tools & Settings → API Center
//   GOOGLE_ADS_CLIENT_ID            — GCP OAuth 2.0 Desktop client
//   GOOGLE_ADS_CLIENT_SECRET        — GCP OAuth 2.0 Desktop client
//   GOOGLE_ADS_REFRESH_TOKEN        — from scripts/ads-oauth-setup.ts
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID    — MCC ID (digits only, no dashes)
//   GOOGLE_ADS_CUSTOMER_ID          — linked account (690-251-4931 → 6902514931)
//
// Usage:
//   bun scripts/ads-audit.ts                  # default: last 90 days
//   bun scripts/ads-audit.ts 30               # last 30 days
//   bun scripts/ads-audit.ts 2026-01-01 2026-04-24

import { GoogleAdsApi, enums } from "google-ads-api"

// ── Env + auth ─────────────────────────────────────────────────────────────

const {
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  GOOGLE_ADS_CUSTOMER_ID,
} = process.env

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`\nMissing ${name} in env. See scripts/ads-audit.ts header for setup.\n`)
    process.exit(1)
  }
  return value
}

const client = new GoogleAdsApi({
  client_id: requireEnv("GOOGLE_ADS_CLIENT_ID", GOOGLE_ADS_CLIENT_ID),
  client_secret: requireEnv("GOOGLE_ADS_CLIENT_SECRET", GOOGLE_ADS_CLIENT_SECRET),
  developer_token: requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN", GOOGLE_ADS_DEVELOPER_TOKEN),
})

const customer = client.Customer({
  customer_id: requireEnv("GOOGLE_ADS_CUSTOMER_ID", GOOGLE_ADS_CUSTOMER_ID).replace(/-/g, ""),
  login_customer_id: requireEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/-/g, ""),
  refresh_token: requireEnv("GOOGLE_ADS_REFRESH_TOKEN", GOOGLE_ADS_REFRESH_TOKEN),
})

// ── Date range ─────────────────────────────────────────────────────────────

function dateRange(): { start: string; end: string; label: string } {
  const args = process.argv.slice(2)
  const today = new Date().toISOString().slice(0, 10)

  if (args.length === 2) {
    return { start: args[0]!, end: args[1]!, label: `${args[0]} → ${args[1]}` }
  }
  const days = args[0] ? parseInt(args[0], 10) : 90
  const start = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
  return { start, end: today, label: `last ${days} days (${start} → ${today})` }
}

const { start, end, label } = dateRange()

// ── Formatters ─────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-CA")
const fmtMoney = (micros: number | string | null | undefined): string => {
  // Google Ads API returns money as micros (1,000,000 = 1 CAD)
  const n = Number(micros ?? 0) / 1_000_000
  return `$${n.toFixed(2)}`
}
const pct = (num: number, denom: number): string =>
  denom === 0 ? "—" : `${((num / denom) * 100).toFixed(1)}%`
const divSafe = (num: number, denom: number): number => (denom === 0 ? 0 : num / denom)

function printSection(title: string): void {
  console.log(`\n${"━".repeat(72)}`)
  console.log(`  ${title}`)
  console.log("━".repeat(72))
}

// ── Queries ────────────────────────────────────────────────────────────────

async function accountSummary(): Promise<void> {
  const rows = await customer.query(`
    SELECT
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM customer
    WHERE segments.date BETWEEN '${start}' AND '${end}'
  `)

  printSection(`ACCOUNT SUMMARY — ${label}`)
  if (rows.length === 0) {
    console.log("No data — account has no activity in this range.")
    return
  }
  const m = rows[0]!.metrics!
  const cost = Number(m.cost_micros ?? 0) / 1_000_000
  const conv = Number(m.conversions ?? 0)
  console.log(`  Spend:         ${fmtMoney(m.cost_micros)}`)
  console.log(`  Impressions:   ${fmt.format(Number(m.impressions ?? 0))}`)
  console.log(`  Clicks:        ${fmt.format(Number(m.clicks ?? 0))}`)
  console.log(`  CTR:           ${((Number(m.ctr ?? 0)) * 100).toFixed(2)}%`)
  console.log(`  Avg CPC:       ${fmtMoney(m.average_cpc)}`)
  console.log(`  Conversions:   ${conv.toFixed(1)}`)
  console.log(`  Cost / conv:   ${conv > 0 ? `$${(cost / conv).toFixed(2)}` : "—"}`)
  console.log(`  Conv value:    ${fmtMoney(Number(m.conversions_value ?? 0) * 1_000_000)}`)
}

interface CampaignRow {
  id: string
  name: string
  status: string
  channel: string
  cost: number
  clicks: number
  impressions: number
  conversions: number
  ctr: number
  cpc: number
  cpl: number
}

async function campaignBreakdown(): Promise<CampaignRow[]> {
  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
    ORDER BY metrics.cost_micros DESC
  `)

  printSection("CAMPAIGNS — by spend")
  console.log(
    `  ${"Campaign".padEnd(34)} ${"Status".padEnd(8)} ${"Channel".padEnd(10)}` +
    ` ${"Spend".padStart(9)} ${"Clicks".padStart(7)} ${"CTR".padStart(6)}` +
    ` ${"CPC".padStart(7)} ${"Conv".padStart(6)} ${"CPL".padStart(8)}`
  )
  console.log(`  ${"-".repeat(106)}`)

  const out: CampaignRow[] = []
  for (const r of rows) {
    const c = r.campaign!
    const m = r.metrics!
    const cost = Number(m.cost_micros ?? 0) / 1_000_000
    const clicks = Number(m.clicks ?? 0)
    const conv = Number(m.conversions ?? 0)
    const ctr = Number(m.ctr ?? 0)
    const cpc = Number(m.average_cpc ?? 0) / 1_000_000
    const cpl = divSafe(cost, conv)
    const statusLabel = enums.CampaignStatus[c.status as number] ?? String(c.status)
    const channelLabel = enums.AdvertisingChannelType[c.advertising_channel_type as number] ?? String(c.advertising_channel_type)

    console.log(
      `  ${(c.name ?? "").slice(0, 34).padEnd(34)} ${statusLabel.padEnd(8)} ${channelLabel.padEnd(10)}` +
      ` ${fmtMoney(m.cost_micros).padStart(9)} ${fmt.format(clicks).padStart(7)}` +
      ` ${(ctr * 100).toFixed(1).padStart(5)}% $${cpc.toFixed(2).padStart(6)}` +
      ` ${conv.toFixed(1).padStart(6)} ${(conv > 0 ? `$${cpl.toFixed(2)}` : "—").padStart(8)}`
    )
    out.push({
      id: String(c.id),
      name: c.name ?? "",
      status: statusLabel,
      channel: channelLabel,
      cost,
      clicks,
      impressions: Number(m.impressions ?? 0),
      conversions: conv,
      ctr,
      cpc,
      cpl,
    })
  }
  return out
}

// Batch-resolve geoTargetConstants/1002550 → "Montréal, QC, Canada".
// One query for all IDs instead of N — Google Ads doesn't support JOINs
// across resources so this is the closest thing to it.
async function resolveGeoNames(resourceNames: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(resourceNames)).filter(Boolean)
  if (unique.length === 0) return new Map()

  const ids = unique.map(rn => rn.replace("geoTargetConstants/", "")).filter(Boolean)
  if (ids.length === 0) return new Map()

  const inList = ids.map(id => `'${id}'`).join(",")
  const rows = await customer.query(`
    SELECT
      geo_target_constant.id,
      geo_target_constant.name,
      geo_target_constant.canonical_name,
      geo_target_constant.target_type
    FROM geo_target_constant
    WHERE geo_target_constant.id IN (${inList})
  `)

  const map = new Map<string, string>()
  for (const r of rows) {
    const id = String(r.geo_target_constant?.id ?? "")
    // canonical_name is e.g. "Montreal, Quebec, Canada" — more useful than
    // name alone ("Montreal") because it disambiguates.
    const canonical = (r.geo_target_constant?.canonical_name ?? "") as string
    const targetType = (r.geo_target_constant?.target_type ?? "") as string
    const suffix = targetType && targetType !== "City" ? ` [${targetType}]` : ""
    map.set(`geoTargetConstants/${id}`, (canonical || "?") + suffix)
  }
  return map
}

async function geoBreakdown(): Promise<void> {
  // Geographic by city — surfaces the "Toronto / Moscow" waste noted in the
  // April 2 audit. Rows come back segmented by geo_target_city; we aggregate
  // in JS because the API returns duplicates segmented by internal criteria
  // (e.g. physical-presence vs area-of-interest match).
  const rows = await customer.query(`
    SELECT
      segments.geo_target_city,
      metrics.cost_micros,
      metrics.clicks,
      metrics.conversions
    FROM geographic_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'
    ORDER BY metrics.cost_micros DESC
  `)

  // Aggregate by city (dedupes the physical-vs-interest split rows)
  interface GeoAgg { cost: number; clicks: number; conv: number }
  const byCity = new Map<string, GeoAgg>()
  for (const r of rows) {
    const m = r.metrics!
    const cityId = (r.segments?.geo_target_city ?? "(not set)") as string
    const prev = byCity.get(cityId) ?? { cost: 0, clicks: 0, conv: 0 }
    prev.cost += Number(m.cost_micros ?? 0) / 1_000_000
    prev.clicks += Number(m.clicks ?? 0)
    prev.conv += Number(m.conversions ?? 0)
    byCity.set(cityId, prev)
  }

  // Sort by spend desc, keep top 25
  const sorted = [...byCity.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 25)

  // Resolve names in one batch
  const nameMap = await resolveGeoNames(sorted.map(([id]) => id))

  printSection("GEO (top 25 cities by spend — deduped + resolved)")
  console.log(`  ${"City".padEnd(44)} ${"Spend".padStart(9)} ${"Clicks".padStart(7)} ${"Conv".padStart(6)} ${"CPL".padStart(8)}`)
  console.log(`  ${"-".repeat(80)}`)

  let totalCost = 0
  let totalClicks = 0
  let totalConv = 0
  for (const [cityId, agg] of sorted) {
    const cityName = nameMap.get(cityId) ?? cityId
    totalCost += agg.cost
    totalClicks += agg.clicks
    totalConv += agg.conv
    const cpl = agg.conv > 0 ? `$${(agg.cost / agg.conv).toFixed(2)}` : "—"
    console.log(
      `  ${cityName.slice(0, 44).padEnd(44)} $${agg.cost.toFixed(2).padStart(8)}` +
      ` ${fmt.format(agg.clicks).padStart(7)} ${agg.conv.toFixed(1).padStart(6)} ${cpl.padStart(8)}`
    )
  }
  console.log(`  ${"-".repeat(80)}`)
  console.log(
    `  ${"TOTAL (top 25)".padEnd(44)} $${totalCost.toFixed(2).padStart(8)}` +
    ` ${fmt.format(totalClicks).padStart(7)} ${totalConv.toFixed(1).padStart(6)}`
  )

  // Surface "waste" candidates — cities with spend but 0 conversions
  const wasted = sorted.filter(([, agg]) => agg.cost > 1 && agg.conv === 0)
  if (wasted.length > 0) {
    console.log(`\n  ⚠ ${wasted.length} cit${wasted.length > 1 ? "ies" : "y"} with spend > $1 and zero conversions:`)
    for (const [cityId, agg] of wasted) {
      const cityName = nameMap.get(cityId) ?? cityId
      console.log(`    • ${cityName.padEnd(44)} $${agg.cost.toFixed(2)} / ${agg.clicks} clicks`)
    }
  }
}

async function deviceBreakdown(): Promise<void> {
  const rows = await customer.query(`
    SELECT
      segments.device,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${start}' AND '${end}'
  `)

  printSection("DEVICE")
  console.log(`  ${"Device".padEnd(14)} ${"Spend".padStart(9)} ${"Impr".padStart(8)} ${"Clicks".padStart(7)} ${"Conv".padStart(6)} ${"CPL".padStart(8)}`)
  console.log(`  ${"-".repeat(58)}`)
  for (const r of rows) {
    const m = r.metrics!
    const device = enums.Device[r.segments?.device as number] ?? "UNKNOWN"
    const cost = Number(m.cost_micros ?? 0) / 1_000_000
    const conv = Number(m.conversions ?? 0)
    console.log(
      `  ${device.padEnd(14)} ${fmtMoney(m.cost_micros).padStart(9)}` +
      ` ${fmt.format(Number(m.impressions ?? 0)).padStart(8)}` +
      ` ${fmt.format(Number(m.clicks ?? 0)).padStart(7)}` +
      ` ${conv.toFixed(1).padStart(6)}` +
      ` ${(conv > 0 ? `$${(cost / conv).toFixed(2)}` : "—").padStart(8)}`
    )
  }
}

async function searchTermsTop(): Promise<void> {
  // Top search terms by cost — the raw queries that triggered ads.
  // Useful for finding negative keywords (burn but no conv).
  const rows = await customer.query(`
    SELECT
      search_term_view.search_term,
      metrics.cost_micros,
      metrics.clicks,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 25
  `)

  printSection("SEARCH TERMS (top 25 by spend) — negative-keyword candidates")
  console.log(`  ${"Term".padEnd(44)} ${"Spend".padStart(9)} ${"Clicks".padStart(7)} ${"Conv".padStart(6)}`)
  console.log(`  ${"-".repeat(72)}`)
  for (const r of rows) {
    const m = r.metrics!
    const term = (r.search_term_view?.search_term ?? "").slice(0, 44)
    console.log(
      `  ${term.padEnd(44)} ${fmtMoney(m.cost_micros).padStart(9)}` +
      ` ${fmt.format(Number(m.clicks ?? 0)).padStart(7)}` +
      ` ${Number(m.conversions ?? 0).toFixed(1).padStart(6)}`
    )
  }
}

async function wastedKeywords(): Promise<void> {
  // Keywords with real spend but zero conversions — the obvious "pause me" list
  const rows = await customer.query(`
    SELECT
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND metrics.cost_micros > 5000000
      AND metrics.conversions = 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 20
  `)

  printSection("WASTED KEYWORDS — spend > $5, zero conversions")
  if (rows.length === 0) {
    console.log("  (none — nice.)")
    return
  }
  console.log(`  ${"Keyword".padEnd(32)} ${"Match".padEnd(8)} ${"Ad Group".padEnd(22)} ${"Spend".padStart(9)} ${"Clicks".padStart(7)}`)
  console.log(`  ${"-".repeat(86)}`)
  for (const r of rows) {
    const m = r.metrics!
    const kw = (r.ad_group_criterion?.keyword?.text ?? "").slice(0, 32)
    const matchType = enums.KeywordMatchType[r.ad_group_criterion?.keyword?.match_type as number] ?? ""
    const ag = (r.ad_group?.name ?? "").slice(0, 22)
    console.log(
      `  ${kw.padEnd(32)} ${matchType.padEnd(8)} ${ag.padEnd(22)}` +
      ` ${fmtMoney(m.cost_micros).padStart(9)} ${fmt.format(Number(m.clicks ?? 0)).padStart(7)}`
    )
  }
}

// ── Daily impressions trend ────────────────────────────────────────────────
// Surfaces "impressions fell off a cliff on date X" — usually a landing-page
// issue (404), policy disapproval, or budget/bid change.
async function impressionsTrend(): Promise<void> {
  const rows = await customer.query(`
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM customer
    WHERE segments.date BETWEEN '${start}' AND '${end}'
    ORDER BY segments.date ASC
  `)

  printSection("DAILY TREND — impressions + clicks")
  if (rows.length === 0) {
    console.log("  No daily data.")
    return
  }

  // ASCII-bar chart normalized to max impressions
  const maxImpr = rows.reduce((m, r) => Math.max(m, Number(r.metrics?.impressions ?? 0)), 1)
  const barWidth = 30

  console.log(`  ${"Date".padEnd(12)} ${"Impr".padStart(6)} ${"Clicks".padStart(7)} ${"Spend".padStart(8)} Trend`)
  console.log(`  ${"-".repeat(80)}`)

  let prevImpr = -1
  for (const r of rows) {
    const date = r.segments?.date ?? ""
    const impr = Number(r.metrics?.impressions ?? 0)
    const clicks = Number(r.metrics?.clicks ?? 0)
    const cost = Number(r.metrics?.cost_micros ?? 0) / 1_000_000
    const barLen = Math.round((impr / maxImpr) * barWidth)
    const bar = "█".repeat(barLen) + "·".repeat(barWidth - barLen)
    // Dropoff marker: current day is <30% of the previous non-zero day
    const drop = prevImpr > 0 && impr > 0 && impr / prevImpr < 0.3 ? " ⚠ dropoff" : ""
    console.log(
      `  ${date.padEnd(12)} ${fmt.format(impr).padStart(6)} ${fmt.format(clicks).padStart(7)}` +
      ` $${cost.toFixed(2).padStart(7)} ${bar}${drop}`
    )
    if (impr > 0) prevImpr = impr
  }

  // Summary: avg of first third vs last third
  const n = rows.length
  const third = Math.floor(n / 3)
  const firstThird = rows.slice(0, third)
  const lastThird = rows.slice(n - third)
  const avgFirst = firstThird.reduce((s, r) => s + Number(r.metrics?.impressions ?? 0), 0) / Math.max(1, firstThird.length)
  const avgLast = lastThird.reduce((s, r) => s + Number(r.metrics?.impressions ?? 0), 0) / Math.max(1, lastThird.length)
  const pctChange = avgFirst > 0 ? ((avgLast - avgFirst) / avgFirst) * 100 : 0
  console.log(
    `\n  First ${third}d avg: ${avgFirst.toFixed(0)} impr/day` +
    ` · Last ${third}d avg: ${avgLast.toFixed(0)} impr/day` +
    ` · Δ ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}%`
  )
}

// ── Final URLs — pull from ads + curl each to check status ────────────────
// The #1 reason impressions drop after a site migration: Google sees 404s
// on the landing pages and throttles delivery (plus quality score tanks).
async function finalUrlsCheck(): Promise<void> {
  // Get all final URLs from enabled ads in enabled ad groups in enabled campaigns
  const rows = await customer.query(`
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.final_mobile_urls,
      ad_group_ad.status,
      ad_group.status,
      campaign.status
    FROM ad_group_ad
    WHERE ad_group_ad.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
  `)

  // Dedupe URLs across ads, keep the campaign/ad_group they live in for the report
  const urlMap = new Map<string, { campaign: string; adGroup: string }[]>()
  for (const r of rows) {
    const campaign = r.campaign?.name ?? ""
    const adGroup = r.ad_group?.name ?? ""
    const urls = [
      ...(r.ad_group_ad?.ad?.final_urls ?? []),
      ...(r.ad_group_ad?.ad?.final_mobile_urls ?? []),
    ]
    for (const url of urls) {
      if (!url) continue
      const prev = urlMap.get(url) ?? []
      if (!prev.some(p => p.campaign === campaign && p.adGroup === adGroup)) {
        prev.push({ campaign, adGroup })
      }
      urlMap.set(url, prev)
    }
  }

  // Also get keyword-level final URLs (override ads if set)
  const kwRows = await customer.query(`
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.final_urls
    FROM keyword_view
    WHERE ad_group_criterion.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
      AND ad_group_criterion.final_urls != ''
  `).catch(() => [] as unknown[])  // optional — some accounts don't have keyword-level URLs

  for (const r of kwRows as Array<{
    campaign?: { name?: string }
    ad_group?: { name?: string }
    ad_group_criterion?: { final_urls?: string[]; keyword?: { text?: string } }
  }>) {
    const urls = r.ad_group_criterion?.final_urls ?? []
    for (const url of urls) {
      if (!url) continue
      const prev = urlMap.get(url) ?? []
      const campaign = r.campaign?.name ?? ""
      const adGroup = r.ad_group?.name ?? ""
      if (!prev.some(p => p.campaign === campaign && p.adGroup === adGroup)) {
        prev.push({ campaign, adGroup })
      }
      urlMap.set(url, prev)
    }
  }

  printSection("FINAL URLs — live HTTP status check")
  if (urlMap.size === 0) {
    console.log("  No enabled final URLs found.")
    return
  }

  console.log(`  Checking ${urlMap.size} unique URLs...\n`)

  const results: Array<{ url: string; status: number | string; locations: string[]; redirect?: string }> = []
  for (const [url, locations] of urlMap) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ChantalAdsAudit/1.0)" },
      })
      let status: number | string = res.status
      let redirect: string | undefined
      // Follow one redirect to report final destination status
      if (res.status >= 300 && res.status < 400) {
        redirect = res.headers.get("location") ?? undefined
        if (redirect) {
          const final = await fetch(redirect, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(10_000),
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ChantalAdsAudit/1.0)" },
          }).catch(() => null)
          if (final) status = `${res.status}→${final.status}`
        }
      }
      results.push({
        url,
        status,
        locations: locations.map(l => `${l.campaign} / ${l.adGroup}`),
        redirect,
      })
    } catch (err) {
      results.push({
        url,
        status: err instanceof Error ? `ERR: ${err.message.slice(0, 30)}` : "ERR",
        locations: locations.map(l => `${l.campaign} / ${l.adGroup}`),
      })
    }
  }

  // Sort: errors + 4xx + 5xx first, then OK
  results.sort((a, b) => {
    const aBad = typeof a.status === "string" || (typeof a.status === "number" && a.status >= 400)
    const bBad = typeof b.status === "string" || (typeof b.status === "number" && b.status >= 400)
    if (aBad && !bBad) return -1
    if (!aBad && bBad) return 1
    return 0
  })

  for (const r of results) {
    const statusStr = String(r.status)
    const bad =
      typeof r.status === "string" ||
      (typeof r.status === "number" && r.status >= 400)
    const mark = bad ? "❌" : (typeof r.status === "number" && r.status >= 300 ? "↪ " : "✓ ")
    console.log(`  ${mark} [${statusStr.padEnd(7)}] ${r.url}`)
    if (r.redirect) console.log(`        → ${r.redirect}`)
    for (const loc of r.locations) {
      console.log(`        in: ${loc}`)
    }
  }

  const broken = results.filter(
    r => typeof r.status === "string" || (typeof r.status === "number" && r.status >= 400),
  )
  if (broken.length > 0) {
    console.log(`\n  ⚠ ${broken.length} broken URL${broken.length > 1 ? "s" : ""}.`)
    console.log(`  This is almost certainly the cause of any impression drop —`)
    console.log(`  Google Ads throttles delivery to ads with 404 destinations.`)
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nGoogle Ads audit — customer ${GOOGLE_ADS_CUSTOMER_ID} — ${label}`)
  console.log(`API via MCC ${GOOGLE_ADS_LOGIN_CUSTOMER_ID}`)

  try {
    await accountSummary()
    await impressionsTrend()
    await finalUrlsCheck()
    await campaignBreakdown()
    await deviceBreakdown()
    await geoBreakdown()
    await searchTermsTop()
    await wastedKeywords()
    console.log("\nDone.\n")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\nQuery failed: ${msg}`)
    // Most common failure modes, with remediation hint:
    if (/developer token/i.test(msg)) {
      console.error("→ Dev token invalid or not approved. Check MCC → API Center.")
    } else if (/USER_PERMISSION_DENIED|not linked/i.test(msg)) {
      console.error(`→ Customer ${GOOGLE_ADS_CUSTOMER_ID} is not linked to MCC ${GOOGLE_ADS_LOGIN_CUSTOMER_ID}.`)
      console.error("→ In the MCC, go to Admin → Linked accounts → Accept pending link.")
    } else if (/invalid_grant/i.test(msg)) {
      console.error("→ Refresh token expired or revoked. Re-run scripts/ads-oauth-setup.ts.")
    }
    process.exit(1)
  }
}

main()
