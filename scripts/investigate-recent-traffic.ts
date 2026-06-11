// GA4 + Google Ads — last 7d vs prior 14d, focused on:
//  - Demographics (gender, age) — needs the property to have demographics enabled
//  - Traffic source/medium + campaign for the /prendre-rendez-vous funnel
//  - Search terms (Google Ads) that drove paid traffic in the last 7 days
//  - Daily generate_lead events split by source/campaign
//
// Use: bun --env-file=.env scripts/investigate-recent-traffic.ts

import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { GoogleAdsApi, enums } from "google-ads-api"
import fs from "node:fs"

const propertyId = "465141726"
const gaKeyPath = ".secrets/tls-analytics-sa-key.json"
if (!fs.existsSync(gaKeyPath)) {
  console.error(`GA4 key missing at ${gaKeyPath}`)
  process.exit(1)
}
const ga = new BetaAnalyticsDataClient({ keyFilename: gaKeyPath })

const today = new Date()
const isoDay = (offset: number) =>
  new Date(today.getTime() - offset * 86400_000).toISOString().slice(0, 10)

const W1 = { startDate: isoDay(7), endDate: isoDay(1), label: "last 7d (D-7 → D-1)" }
const W2 = { startDate: isoDay(21), endDate: isoDay(8), label: "prior 14d (D-21 → D-8)" }

function printSection(title: string) {
  console.log("\n" + "━".repeat(76) + "\n  " + title + "\n" + "━".repeat(76))
}

async function ga4Report(
  name: string,
  dimensions: string[],
  metrics: string[],
  dateRange: { startDate: string; endDate: string },
  limit = 25,
) {
  const [response] = await ga.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
    dimensions: dimensions.map((d) => ({ name: d })),
    metrics: metrics.map((m) => ({ name: m })),
    limit,
  })
  console.log(`\n  ${name}  [${dateRange.startDate} → ${dateRange.endDate}]`)
  console.log("  " + "-".repeat(74))
  const dh = response.dimensionHeaders?.map((h) => h.name) ?? []
  const mh = response.metricHeaders?.map((h) => h.name) ?? []
  console.log("  " + [...dh, ...mh].join("\t"))
  for (const row of response.rows ?? []) {
    const dvs = row.dimensionValues?.map((d) => d.value ?? "") ?? []
    const mvs = row.metricValues?.map((m) => m.value ?? "") ?? []
    console.log("  " + [...dvs, ...mvs].join("\t"))
  }
  if ((response.rows ?? []).length === 0) console.log("  (no data)")
}

async function main() {
  printSection("GA4 — DEMOGRAPHICS (last 7d vs prior 14d)")
  await ga4Report("Gender (last 7d)", ["userGender"], ["sessions", "totalUsers", "engagedSessions"], W1)
  await ga4Report("Gender (prior 14d)", ["userGender"], ["sessions", "totalUsers", "engagedSessions"], W2)
  await ga4Report("Age (last 7d)", ["userAgeBracket"], ["sessions", "totalUsers"], W1)

  printSection("GA4 — SOURCE / MEDIUM (last 7d vs prior 14d)")
  await ga4Report(
    "Source/Medium (last 7d)",
    ["sessionSourceMedium"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate"],
    W1,
  )
  await ga4Report(
    "Source/Medium (prior 14d)",
    ["sessionSourceMedium"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate"],
    W2,
  )

  printSection("GA4 — PAID CAMPAIGNS (last 7d)")
  await ga4Report(
    "Campaign × Ad Group (last 7d)",
    ["sessionCampaignName", "sessionGoogleAdsAdGroupName"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate", "averageSessionDuration"],
    W1,
  )

  printSection("GA4 — LANDING PAGE × SOURCE (last 7d)")
  await ga4Report(
    "Landing × Source",
    ["landingPage", "sessionSourceMedium"],
    ["sessions", "totalUsers", "engagedSessions"],
    W1,
    50,
  )

  printSection("GA4 — KEY EVENTS (last 7d, ordered by count)")
  await ga4Report(
    "Events (last 7d)",
    ["eventName"],
    ["eventCount", "totalUsers"],
    W1,
    50,
  )

  printSection("GA4 — generate_lead BY SOURCE (last 7d)")
  // GA4 doesn't filter by event in standard runReport — use eventName dim instead
  const [leadResp] = await ga.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: W1.startDate, endDate: W1.endDate }],
    dimensions: [{ name: "eventName" }, { name: "sessionSourceMedium" }, { name: "sessionCampaignName" }],
    metrics: [{ name: "eventCount" }],
    limit: 50,
  })
  for (const row of leadResp.rows ?? []) {
    const [event, sm, camp] = row.dimensionValues?.map((d) => d.value ?? "") ?? []
    if (event !== "generate_lead" && event !== "lp_cta_click" && event !== "begin_checkout") continue
    const c = row.metricValues?.[0]?.value ?? ""
    console.log(`  ${event.padEnd(20)} ${(sm ?? "").padEnd(30)} camp=${camp ?? ""} count=${c}`)
  }

  // ─── Google Ads ──────────────────────────────────────────────────────
  printSection("GOOGLE ADS — search terms (last 7d)")
  const {
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    GOOGLE_ADS_CUSTOMER_ID,
  } = process.env
  if (
    !GOOGLE_ADS_CLIENT_ID ||
    !GOOGLE_ADS_CLIENT_SECRET ||
    !GOOGLE_ADS_DEVELOPER_TOKEN ||
    !GOOGLE_ADS_REFRESH_TOKEN ||
    !GOOGLE_ADS_LOGIN_CUSTOMER_ID ||
    !GOOGLE_ADS_CUSTOMER_ID
  ) {
    console.log("  (missing Google Ads env vars — skipping)")
    return
  }
  const adsClient = new GoogleAdsApi({
    client_id: GOOGLE_ADS_CLIENT_ID,
    client_secret: GOOGLE_ADS_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  })
  const customer = adsClient.Customer({
    customer_id: GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ""),
    login_customer_id: GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, ""),
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
  })

  const stRows = await customer.query(`
    SELECT
      campaign.name,
      ad_group.name,
      search_term_view.search_term,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${W1.startDate}' AND '${W1.endDate}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 60
  `)
  console.log(`\n  search terms (n=${stRows.length})`)
  for (const r of stRows) {
    const t = r.search_term_view?.search_term ?? ""
    const camp = r.campaign?.name ?? ""
    const ag = r.ad_group?.name ?? ""
    const cost = Number(r.metrics?.cost_micros ?? 0) / 1_000_000
    const clicks = Number(r.metrics?.clicks ?? 0)
    const conv = Number(r.metrics?.conversions ?? 0)
    console.log(
      `  $${cost.toFixed(2).padStart(6)}  clicks=${String(clicks).padStart(3)}  conv=${conv.toFixed(1)}  [${camp} / ${ag}]  ${t}`,
    )
  }

  // Campaign-level demographic / device split for last 7d
  printSection("GOOGLE ADS — campaign × gender (last 7d)")
  // gender_view requires demographic targeting on the campaign — may be empty.
  const genderRows = await customer
    .query(
      `
      SELECT
        campaign.name,
        ad_group.name,
        ad_group_criterion.gender.type,
        metrics.cost_micros,
        metrics.clicks,
        metrics.conversions
      FROM gender_view
      WHERE segments.date BETWEEN '${W1.startDate}' AND '${W1.endDate}'
      ORDER BY metrics.cost_micros DESC
    `,
    )
    .catch((err: Error) => {
      console.log("  gender_view query failed:", err.message)
      return [] as unknown[]
    })
  for (const r of genderRows as Array<{
    campaign?: { name?: string }
    ad_group?: { name?: string }
    ad_group_criterion?: { gender?: { type?: number } }
    metrics?: { cost_micros?: number; clicks?: number; conversions?: number }
  }>) {
    const gender = enums.GenderType[r.ad_group_criterion?.gender?.type ?? 0] ?? "?"
    const cost = Number(r.metrics?.cost_micros ?? 0) / 1_000_000
    const clicks = Number(r.metrics?.clicks ?? 0)
    const conv = Number(r.metrics?.conversions ?? 0)
    console.log(
      `  ${(r.campaign?.name ?? "").padEnd(30)} ${(r.ad_group?.name ?? "").padEnd(20)} ${gender.padEnd(12)} $${cost.toFixed(2)}  clicks=${clicks}  conv=${conv.toFixed(1)}`,
    )
  }

  // Recent ads changes — anything modified in last 21 days
  printSection("GOOGLE ADS — recent campaign / ad group changes (last 21d)")
  const changeStart = isoDay(21)
  const changeEnd = isoDay(0)
  const changes = await customer
    .query(
      `
      SELECT
        change_event.change_date_time,
        change_event.change_resource_type,
        change_event.resource_change_operation,
        change_event.user_email,
        change_event.changed_fields,
        change_event.old_resource,
        change_event.new_resource
      FROM change_event
      WHERE change_event.change_date_time DURING LAST_14_DAYS
      ORDER BY change_event.change_date_time DESC
      LIMIT 100
    `,
    )
    .catch((err: Error) => {
      console.log("  change_event query failed:", err.message)
      return [] as unknown[]
    })
  for (const r of changes as Array<{
    change_event?: {
      change_date_time?: string
      change_resource_type?: number
      resource_change_operation?: number
      user_email?: string
      changed_fields?: string
    }
  }>) {
    const c = r.change_event!
    const t = enums.ChangeClientType[(c as any).client_type ?? 0]
    const rType = enums.ChangeEventResourceType[c.change_resource_type as number] ?? "?"
    const op = enums.ResourceChangeOperation[c.resource_change_operation as number] ?? "?"
    console.log(
      `  ${(c.change_date_time ?? "").slice(0, 19)}  ${op.padEnd(7)} ${rType.padEnd(22)} by=${c.user_email ?? ""}  fields=${c.changed_fields ?? ""}`,
    )
  }

  printSection("DONE")
}

await main().catch((err) => {
  console.error("Failed:", err)
  process.exit(1)
})
