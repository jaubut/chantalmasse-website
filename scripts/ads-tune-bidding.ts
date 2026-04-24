// Tunes daily budgets and tCPA on active Search campaigns.
// Used to break Smart Bidding out of a "zero-conversions → zero-bids" deadlock
// by raising tCPA (so the algo has room to win auctions) and raising budget
// (so campaigns aren't `BUDGET_CONSTRAINED` while they re-learn).
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

interface Tuning {
  campaignName: string
  newBudgetDaily: number   // CAD
  newTargetCpa: number     // CAD
}

const TUNINGS: Tuning[] = [
  { campaignName: "Thérapie individuelle", newBudgetDaily: 4.40, newTargetCpa: 1.80 },
  { campaignName: "Thérapie couple",       newBudgetDaily: 8.00, newTargetCpa: 2.50 },
]

async function main() {
  // Fetch current state so we can show before/after
  const rows = await customer.query(`
    SELECT
      campaign.name,
      campaign.resource_name,
      campaign.bidding_strategy_type,
      campaign.maximize_conversions.target_cpa_micros,
      campaign_budget.resource_name,
      campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.status = "ENABLED"
  `)

  interface Snap {
    campaignRn: string
    budgetRn: string
    currentBudget: number
    currentTcpa: number
  }
  const snapshot = new Map<string, Snap>()
  for (const r of rows) {
    const name = r.campaign?.name ?? ""
    snapshot.set(name, {
      campaignRn: r.campaign?.resource_name ?? "",
      budgetRn: r.campaign_budget?.resource_name ?? "",
      currentBudget: Number(r.campaign_budget?.amount_micros ?? 0) / 1_000_000,
      currentTcpa: Number(r.campaign?.maximize_conversions?.target_cpa_micros ?? 0) / 1_000_000,
    })
  }

  // Preview
  console.log(`\n${COMMIT ? "COMMIT" : "DRY RUN"} — tuning ${TUNINGS.length} campaign(s)\n`)
  const budgetOps: { resource_name: string; amount_micros: number }[] = []
  const campaignOps: { resource_name: string; maximize_conversions: { target_cpa_micros: number } }[] = []

  for (const t of TUNINGS) {
    const snap = snapshot.get(t.campaignName)
    if (!snap) {
      console.error(`✗ Campaign not found: ${t.campaignName}`)
      process.exit(1)
    }
    console.log(`  ${t.campaignName}`)
    console.log(`    budget:  $${snap.currentBudget.toFixed(2)}/day  →  $${t.newBudgetDaily.toFixed(2)}/day`)
    console.log(`    tCPA:    $${snap.currentTcpa.toFixed(2)}        →  $${t.newTargetCpa.toFixed(2)}`)
    console.log()

    budgetOps.push({
      resource_name: snap.budgetRn,
      amount_micros: Math.round(t.newBudgetDaily * 1_000_000),
    })
    campaignOps.push({
      resource_name: snap.campaignRn,
      maximize_conversions: { target_cpa_micros: Math.round(t.newTargetCpa * 1_000_000) },
    })
  }

  if (!COMMIT) {
    console.log("(dry run — re-run with --commit to actually apply)\n")
    return
  }

  console.log("Updating campaign budgets...")
  // @ts-expect-error — update typing loose on this service
  const budgetResult = await customer.campaignBudgets.update(budgetOps)
  console.log(`  ${budgetResult.results?.length ?? 0} budget(s) updated`)

  console.log("\nUpdating campaign tCPAs...")
  // @ts-expect-error — same
  const campaignResult = await customer.campaigns.update(campaignOps)
  console.log(`  ${campaignResult.results?.length ?? 0} campaign(s) updated`)

  console.log("\n✓ Done. Smart Bidding will start adjusting immediately.")
  console.log("  Re-run the audit in 7 days to check if impressions + conversions recovered.")
}

main().catch(err => {
  console.error("\n✗ Failed:", err instanceof Error ? err.message : String(err))
  if (err && typeof err === "object" && "errors" in err) {
    console.error(JSON.stringify((err as { errors: unknown }).errors, null, 2))
  }
  process.exit(1)
})
