// Deep dig — last 21d ad changes, ad copy, audience targeting, and a tighter
// search-term spike check. Run after investigate-recent-traffic.ts.
//
// Use: bun --env-file=.env scripts/investigate-deep-ads.ts

import { GoogleAdsApi, enums } from "google-ads-api"

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
  console.error("Missing Google Ads env vars")
  process.exit(1)
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

function printSection(title: string) {
  console.log("\n" + "━".repeat(76) + "\n  " + title + "\n" + "━".repeat(76))
}

// ── 1. Recent campaign / ad group / criterion changes ─────────────────────
printSection("DETAILED change_event (last 14d)")
const changes = await customer.query(`
  SELECT
    change_event.change_date_time,
    change_event.change_resource_type,
    change_event.changed_fields,
    change_event.resource_change_operation,
    change_event.user_email,
    change_event.old_resource,
    change_event.new_resource,
    change_event.client_type,
    campaign.name,
    ad_group.name
  FROM change_event
  WHERE change_event.change_date_time DURING LAST_14_DAYS
  ORDER BY change_event.change_date_time DESC
  LIMIT 100
`)

for (const r of changes) {
  const c: any = (r as any).change_event ?? {}
  const rType = enums.ChangeEventResourceType[c.change_resource_type as number] ?? "?"
  const op = enums.ResourceChangeOperation[c.resource_change_operation as number] ?? "?"
  const clientType = enums.ChangeClientType[c.client_type as number] ?? "?"
  const fields = c.changed_fields
  const fieldsStr = typeof fields === "string" ? fields : Array.isArray(fields?.paths) ? fields.paths.join(",") : JSON.stringify(fields)
  console.log(
    `\n  ${(c.change_date_time ?? "").slice(0, 19)}  ${op.padEnd(7)} ${rType.padEnd(22)}` +
    `\n    by ${c.user_email ?? "?"}  via ${clientType}` +
    `\n    campaign=${(r as any).campaign?.name ?? "-"}  ad_group=${(r as any).ad_group?.name ?? "-"}` +
    `\n    fields=${fieldsStr}`,
  )
  if (c.old_resource && c.new_resource) {
    try {
      const oldR = typeof c.old_resource === "string" ? JSON.parse(c.old_resource) : c.old_resource
      const newR = typeof c.new_resource === "string" ? JSON.parse(c.new_resource) : c.new_resource
      console.log(`    OLD: ${JSON.stringify(oldR).slice(0, 280)}`)
      console.log(`    NEW: ${JSON.stringify(newR).slice(0, 280)}`)
    } catch {
      console.log(`    OLD: ${String(c.old_resource).slice(0, 280)}`)
      console.log(`    NEW: ${String(c.new_resource).slice(0, 280)}`)
    }
  }
}

// ── 2. All enabled campaigns / ad groups summary ──────────────────────────
printSection("CAMPAIGN STRUCTURE — enabled campaigns + their ad groups")
const campRows = await customer.query(`
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    campaign.bidding_strategy_type,
    campaign.target_cpa.target_cpa_micros,
    campaign.maximize_conversions.target_cpa_micros,
    campaign_budget.amount_micros
  FROM campaign
  WHERE campaign.status = 'ENABLED'
`)
for (const r of campRows) {
  const c: any = r.campaign!
  const cb: any = (r as any).campaign_budget ?? {}
  const ct = enums.AdvertisingChannelType[c.advertising_channel_type as number] ?? "?"
  const bid = enums.BiddingStrategyType[c.bidding_strategy_type as number] ?? "?"
  const tcpa = Number(c.target_cpa?.target_cpa_micros ?? c.maximize_conversions?.target_cpa_micros ?? 0) / 1_000_000
  const budget = Number(cb.amount_micros ?? 0) / 1_000_000
  console.log(
    `  • ${c.name?.padEnd(36)} [${ct}] bid=${bid} ${tcpa ? `tCPA=$${tcpa.toFixed(2)}` : ""} budget=$${budget.toFixed(2)}/day`,
  )
}

// ── 3. Ad copy — RSA headlines/descriptions in enabled ad groups ──────────
printSection("AD COPY — enabled responsive search ads")
const adRows = await customer.query(`
  SELECT
    campaign.name,
    ad_group.name,
    ad_group_ad.ad.id,
    ad_group_ad.ad.responsive_search_ad.headlines,
    ad_group_ad.ad.responsive_search_ad.descriptions,
    ad_group_ad.ad.final_urls,
    ad_group_ad.status
  FROM ad_group_ad
  WHERE ad_group_ad.status = 'ENABLED'
    AND ad_group.status = 'ENABLED'
    AND campaign.status = 'ENABLED'
`)
for (const r of adRows) {
  const adg: any = r.ad_group_ad?.ad ?? {}
  const rsa = adg.responsive_search_ad ?? {}
  const heads: string[] = (rsa.headlines ?? []).map((h: any) => h.text).filter(Boolean)
  const descs: string[] = (rsa.descriptions ?? []).map((d: any) => d.text).filter(Boolean)
  console.log(`\n  ── ${r.campaign?.name} / ${r.ad_group?.name}  (ad id ${adg.id})`)
  console.log(`     URL: ${(adg.final_urls ?? []).join(", ")}`)
  console.log(`     HEADLINES (${heads.length}):`)
  for (const h of heads) console.log(`       • ${h}`)
  console.log(`     DESCRIPTIONS (${descs.length}):`)
  for (const d of descs) console.log(`       • ${d}`)
}

// ── 4. Audience / gender / age / parental criteria on enabled ad groups ───
printSection("AD GROUP AUDIENCE CRITERIA (gender / age / income / parental)")
const audRows = await customer.query(`
  SELECT
    campaign.name,
    ad_group.name,
    ad_group_criterion.type,
    ad_group_criterion.gender.type,
    ad_group_criterion.age_range.type,
    ad_group_criterion.parental_status.type,
    ad_group_criterion.income_range.type,
    ad_group_criterion.status,
    ad_group_criterion.negative
  FROM ad_group_criterion
  WHERE campaign.status = 'ENABLED'
    AND ad_group.status = 'ENABLED'
    AND ad_group_criterion.type IN (GENDER, AGE_RANGE, INCOME_RANGE, PARENTAL_STATUS)
`)
for (const r of audRows) {
  const c: any = r.ad_group_criterion ?? {}
  const type = enums.CriterionType[c.type as number] ?? "?"
  let value = ""
  if (type === "GENDER") value = enums.GenderType[c.gender?.type as number] ?? "?"
  else if (type === "AGE_RANGE") value = enums.AgeRangeType[c.age_range?.type as number] ?? "?"
  else if (type === "INCOME_RANGE") value = enums.IncomeRangeType[c.income_range?.type as number] ?? "?"
  else if (type === "PARENTAL_STATUS") value = enums.ParentalStatusType[c.parental_status?.type as number] ?? "?"
  const status = enums.AdGroupCriterionStatus[c.status as number] ?? "?"
  const neg = c.negative ? " (NEGATIVE)" : ""
  console.log(`  ${(r.campaign?.name ?? "").padEnd(30)} ${(r.ad_group?.name ?? "").padEnd(28)} ${type.padEnd(16)} ${value.padEnd(22)} ${status}${neg}`)
}

// ── 5. Campaign-level audience criteria ───────────────────────────────────
printSection("CAMPAIGN-LEVEL CRITERIA (audience, geo, demographics)")
const ccRows = await customer.query(`
  SELECT
    campaign.name,
    campaign_criterion.type,
    campaign_criterion.gender.type,
    campaign_criterion.age_range.type,
    campaign_criterion.location.geo_target_constant,
    campaign_criterion.proximity.radius,
    campaign_criterion.proximity.radius_units,
    campaign_criterion.proximity.geo_point.latitude_in_micro_degrees,
    campaign_criterion.proximity.geo_point.longitude_in_micro_degrees,
    campaign_criterion.status,
    campaign_criterion.negative
  FROM campaign_criterion
  WHERE campaign.status = 'ENABLED'
    AND campaign_criterion.type IN (GENDER, AGE_RANGE, LOCATION, PROXIMITY)
  LIMIT 200
`)
for (const r of ccRows) {
  const c: any = (r as any).campaign_criterion ?? {}
  const type = enums.CriterionType[c.type as number] ?? "?"
  let value = ""
  if (type === "GENDER") value = enums.GenderType[c.gender?.type as number] ?? "?"
  else if (type === "AGE_RANGE") value = enums.AgeRangeType[c.age_range?.type as number] ?? "?"
  else if (type === "LOCATION") value = c.location?.geo_target_constant ?? "?"
  else if (type === "PROXIMITY") {
    const radius = c.proximity?.radius
    const unit = enums.ProximityRadiusUnits[c.proximity?.radius_units as number] ?? ""
    const lat = Number(c.proximity?.geo_point?.latitude_in_micro_degrees ?? 0) / 1e6
    const lng = Number(c.proximity?.geo_point?.longitude_in_micro_degrees ?? 0) / 1e6
    value = `radius=${radius}${unit} @ ${lat.toFixed(3)},${lng.toFixed(3)}`
  }
  const neg = c.negative ? " (NEGATIVE)" : ""
  console.log(`  ${(r.campaign?.name ?? "").padEnd(35)} ${type.padEnd(12)} ${value}${neg}`)
}

// ── 6. Daily campaign performance trend for last 21d ──────────────────────
printSection("DAILY CAMPAIGN TREND (last 21d) — last 7 vs week-2")
const dailyRows = await customer.query(`
  SELECT
    campaign.name,
    segments.date,
    metrics.cost_micros,
    metrics.clicks,
    metrics.impressions,
    metrics.conversions
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND campaign.status = 'ENABLED'
  ORDER BY segments.date ASC, campaign.name
`)

type DailyAgg = { cost: number; clicks: number; impr: number; conv: number }
const byDayCamp = new Map<string, DailyAgg>()
const byWindowCamp = new Map<string, { week1: DailyAgg; week2: DailyAgg }>()
const today = new Date()
for (const r of dailyRows) {
  const date = (r as any).segments?.date as string
  const camp = (r as any).campaign?.name as string
  const m: any = r.metrics ?? {}
  const cost = Number(m.cost_micros ?? 0) / 1_000_000
  const clicks = Number(m.clicks ?? 0)
  const impr = Number(m.impressions ?? 0)
  const conv = Number(m.conversions ?? 0)

  const key = `${date}__${camp}`
  byDayCamp.set(key, { cost, clicks, impr, conv })

  const ageDays = (today.getTime() - new Date(date).getTime()) / 86400_000
  const bucket = ageDays <= 7 ? "week1" : ageDays <= 14 ? "week2" : null
  if (!bucket) continue
  const prev = byWindowCamp.get(camp) ?? {
    week1: { cost: 0, clicks: 0, impr: 0, conv: 0 },
    week2: { cost: 0, clicks: 0, impr: 0, conv: 0 },
  }
  const b = prev[bucket]
  b.cost += cost
  b.clicks += clicks
  b.impr += impr
  b.conv += conv
  byWindowCamp.set(camp, prev)
}

console.log(`\n  Campaign                          | last 7d                    | prior 7d                   | Δ`)
console.log(`  ${"-".repeat(110)}`)
for (const [camp, w] of byWindowCamp) {
  const c1 = w.week1
  const c2 = w.week2
  const fmt = (a: DailyAgg) =>
    `$${a.cost.toFixed(2).padStart(7)} cl=${String(a.clicks).padStart(3)} im=${String(a.impr).padStart(5)} cv=${a.conv.toFixed(1)}`
  const delta = c2.impr > 0 ? `${(((c1.impr - c2.impr) / c2.impr) * 100).toFixed(0)}% impr` : "—"
  console.log(`  ${camp.padEnd(34)} | ${fmt(c1)} | ${fmt(c2)} | ${delta}`)
}

console.log("\nDONE.")
