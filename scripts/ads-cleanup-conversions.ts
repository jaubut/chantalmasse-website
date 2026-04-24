// Archives dead / legacy conversion actions in bulk via Google Ads API.
// Dry-run by default — pass `--commit` to actually archive.
//
// Safe operation: "REMOVED" in Google Ads API = archived, not deleted. History
// is preserved; actions stop being available for new linking.
//
// Usage:
//   bun scripts/ads-cleanup-conversions.ts             # dry run
//   bun scripts/ads-cleanup-conversions.ts --commit    # actually archive

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
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, "")

// Keep these two active — every other non-archived action gets removed.
const KEEP_IDS = new Set<string>([
  "6918505399",   // Envoi de formulaire pour prospects — primary, 1173 conv
  "7358939433",   // Calls from ads — phone call tracking, low volume but real
])

async function main() {
  const rows = await customer.query(`
    SELECT conversion_action.id, conversion_action.name, conversion_action.status
    FROM conversion_action
    WHERE conversion_action.status != "REMOVED"
  `)

  const toArchive: { id: string; name: string; resource_name: string }[] = []
  const keeping: { id: string; name: string }[] = []

  for (const r of rows) {
    const id = String(r.conversion_action?.id ?? "")
    const name = r.conversion_action?.name ?? ""
    const rn = `customers/${CUSTOMER_ID}/conversionActions/${id}`
    if (KEEP_IDS.has(id)) keeping.push({ id, name })
    else toArchive.push({ id, name, resource_name: rn })
  }

  console.log(`\nKeeping ${keeping.length}:`)
  for (const k of keeping) console.log(`  ✓ [${k.id}] ${k.name}`)

  console.log(`\n${COMMIT ? "ARCHIVING" : "Would archive"} ${toArchive.length}:`)
  for (const a of toArchive) console.log(`  🗑  [${a.id}] ${a.name}`)

  if (!COMMIT) {
    console.log("\n(dry run — re-run with --commit to actually archive)\n")
    return
  }

  console.log("\nSending remove ops...")
  // Conversion actions can't be archived via status=REMOVED in an update —
  // the API gates that enum. Use the remove mutation which does the archive
  // under the hood (history preserved, just marked removed).
  const resourceNames = toArchive.map(a => a.resource_name)

  // @ts-expect-error — remove() typing on this service is loose
  const result = await customer.conversionActions.remove(resourceNames)
  console.log(`\n✓ Archived ${result.results?.length ?? 0} conversion action(s).`)
}

main().catch(err => {
  console.error("\n✗ Failed:", err instanceof Error ? err.message : String(err))
  if (err && typeof err === "object" && "errors" in err) {
    console.error(JSON.stringify((err as { errors: unknown }).errors, null, 2))
  }
  process.exit(1)
})
