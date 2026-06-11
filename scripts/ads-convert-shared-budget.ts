// One-shot: convert "Thérapie couple" + "Thérapie individuelle" from
// per-campaign budgets to a single explicitly-shared budget. Lets Google
// auto-allocate the $250/mo pool toward whichever campaign converts better.
//
// Dry-run by default. `--commit` to execute.

import { GoogleAdsApi } from "google-ads-api"

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
})
const customer = client.Customer({
  customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, ""),
  login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!.replace(/-/g, ""),
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
})

const COMMIT = process.argv.includes("--commit")
const SHARED_BUDGET_NAME = "Shared — Thérapie (couple + individuelle)"
const SHARED_DAILY_CAD = 8.22 // $250/mo ÷ 30.4
const TARGET_CAMPAIGNS = ["Thérapie couple", "Thérapie individuelle"]

const rows = await customer.query(`
  SELECT
    campaign.name,
    campaign.resource_name,
    campaign_budget.resource_name,
    campaign_budget.name,
    campaign_budget.amount_micros,
    campaign_budget.explicitly_shared
  FROM campaign
  WHERE campaign.status = "ENABLED"
`)

const found = new Map<string, { campaignRn: string; oldBudgetRn: string; oldBudgetName: string; oldDaily: number; isShared: boolean }>()
for (const r of rows) {
  const name = r.campaign?.name ?? ""
  if (!TARGET_CAMPAIGNS.includes(name)) continue
  found.set(name, {
    campaignRn: r.campaign?.resource_name ?? "",
    oldBudgetRn: r.campaign_budget?.resource_name ?? "",
    oldBudgetName: r.campaign_budget?.name ?? "",
    oldDaily: Number(r.campaign_budget?.amount_micros ?? 0) / 1_000_000,
    isShared: Boolean(r.campaign_budget?.explicitly_shared),
  })
}

console.log(`\n${COMMIT ? "COMMIT" : "DRY RUN"} — convert to shared budget\n`)
for (const name of TARGET_CAMPAIGNS) {
  const f = found.get(name)
  if (!f) {
    console.error(`✗ Campaign not found: ${name}`)
    process.exit(1)
  }
  console.log(`  ${name}`)
  console.log(`    current budget: "${f.oldBudgetName}" ($${f.oldDaily.toFixed(2)}/day, shared=${f.isShared})`)
}

// Check if already converted (both pointing at the same shared budget)
const budgetRns = new Set([...found.values()].map((f) => f.oldBudgetRn))
const alreadyShared = budgetRns.size === 1 && [...found.values()].every((f) => f.isShared)
if (alreadyShared) {
  console.log(`\nAlready on a shared budget — nothing to do.`)
  process.exit(0)
}

console.log(
  `\n  → Create shared budget "${SHARED_BUDGET_NAME}" at $${SHARED_DAILY_CAD}/day (~$${(SHARED_DAILY_CAD * 30.4).toFixed(0)}/mo)`,
)
for (const name of TARGET_CAMPAIGNS) {
  console.log(`  → Repoint "${name}" at the new shared budget`)
}
console.log(`  → Leave old budgets in place (they become orphaned; safe to delete via UI later)`)

if (!COMMIT) {
  console.log("\n(dry run — re-run with --commit to actually apply)\n")
  process.exit(0)
}

// 1. Create the shared budget
console.log("\nCreating shared budget…")
// @ts-expect-error — service typings are loose
const created = await customer.campaignBudgets.create([
  {
    name: SHARED_BUDGET_NAME,
    amount_micros: Math.round(SHARED_DAILY_CAD * 1_000_000),
    delivery_method: "STANDARD",
    explicitly_shared: true,
    period: "DAILY",
  },
])
const newBudgetRn: string = created.results?.[0]?.resource_name ?? ""
if (!newBudgetRn) {
  console.error("✗ Failed to create shared budget — no resource_name returned")
  console.error(JSON.stringify(created, null, 2))
  process.exit(1)
}
console.log(`  ✓ Created: ${newBudgetRn}`)

// 2. Repoint each campaign to the new shared budget
console.log("\nRepointing campaigns…")
const updateOps = [...found.values()].map((f) => ({
  resource_name: f.campaignRn,
  campaign_budget: newBudgetRn,
}))
// @ts-expect-error — same loose typings
const updated = await customer.campaigns.update(updateOps)
console.log(`  ✓ ${updated.results?.length ?? 0} campaign(s) updated`)

console.log("\n✓ Done. Both campaigns now share a $8.22/day budget.")
console.log("  Google will allocate the pool to whichever campaign converts better.")
console.log("  The two old per-campaign budgets are now orphaned and can be left as-is.")
