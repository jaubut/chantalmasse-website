// Creates sitelink assets and attaches them to campaigns.
// Dry-run by default — pass `--commit` to actually create.
//
// Usage:
//   bun scripts/ads-add-sitelinks.ts             # dry run
//   bun scripts/ads-add-sitelinks.ts --commit    # actually create

import { GoogleAdsApi, enums, ResourceNames } from "google-ads-api"

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

interface Sitelink {
  campaignName: string
  linkText: string
  finalUrl: string
  description1: string
  description2: string
}

// 12 sitelinks — 6 per campaign. Voice matches ~/tls-vault/clients/chantal-masse/voice.md:
// tutoiement, concrete anchors (Shefford, 60 min), no wellness tropes.
const SITELINKS: Sitelink[] = [
  // Thérapie individuelle
  { campaignName: "Thérapie individuelle", linkText: "Prendre rendez-vous", finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous", description1: "Disponibilité cette semaine", description2: "Vidéo ou présentiel" },
  { campaignName: "Thérapie individuelle", linkText: "Thérapie individuelle", finalUrl: "https://www.chantalmasse.com/therapie-individuelle", description1: "Écoute, sans jugement", description2: "20 ans en relation d'aide" },
  { campaignName: "Thérapie individuelle", linkText: "Shefford ou en visio", finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous", description1: "Bureau en Haute-Yamaska", description2: "Ou lien sécurisé à distance" },
  { campaignName: "Thérapie individuelle", linkText: "À propos de Chantal", finalUrl: "https://www.chantalmasse.com/journey", description1: "Thérapeute en relation d'aide", description2: "Shefford, Montérégie" },
  { campaignName: "Thérapie individuelle", linkText: "Tarifs & assurances", finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous", description1: "Reçus pour assurances", description2: "Séances de 60 minutes" },
  { campaignName: "Thérapie individuelle", linkText: "Questions fréquentes", finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous", description1: "Durée, annulation, format", description2: "Tout savoir avant de commencer" },
  // Thérapie couple
  { campaignName: "Thérapie couple", linkText: "Prendre rendez-vous", finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous?service=couple", description1: "Disponibilité cette semaine", description2: "En couple, sans détour" },
  { campaignName: "Thérapie couple", linkText: "Coaching de couple", finalUrl: "https://www.chantalmasse.com/coaching-de-couple", description1: "Retrouver le lien", description2: "Deux voix écoutées" },
  { campaignName: "Thérapie couple", linkText: "Shefford ou en visio", finalUrl: "https://www.chantalmasse.com/coaching-de-couple", description1: "Présence ou à distance", description2: "Vous choisissez ensemble" },
  { campaignName: "Thérapie couple", linkText: "À propos de Chantal", finalUrl: "https://www.chantalmasse.com/journey", description1: "20 ans en relation d'aide", description2: "Formation couple & famille" },
  { campaignName: "Thérapie couple", linkText: "Tarifs & assurances", finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous", description1: "Reçus pour assurances", description2: "Séances de 60 minutes" },
  { campaignName: "Thérapie couple", linkText: "Questions fréquentes", finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous", description1: "Durée, annulation, format", description2: "Toutes les réponses" },
]

// ── Lookups ───────────────────────────────────────────────────────────────

async function resolveCampaigns(): Promise<Map<string, string>> {
  const rows = await customer.query(`
    SELECT campaign.id, campaign.name, campaign.resource_name
    FROM campaign
    WHERE campaign.status = 'ENABLED'
  `)
  const map = new Map<string, string>()
  for (const r of rows) {
    const name = r.campaign?.name ?? ""
    const rn = r.campaign?.resource_name ?? ""
    if (name && rn) map.set(name, rn)
  }
  return map
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const campaigns = await resolveCampaigns()
  console.log(`\nResolved ${campaigns.size} enabled campaigns:`)
  for (const [name] of campaigns) console.log(`  • ${name}`)

  // Validate every sitelink points at a known campaign
  const missing = SITELINKS.filter(s => !campaigns.has(s.campaignName))
  if (missing.length > 0) {
    console.error(`\n✗ ${missing.length} sitelink(s) reference unknown campaigns:`)
    for (const m of missing) console.error(`    ${m.campaignName} / ${m.linkText}`)
    process.exit(1)
  }

  console.log(`\n${COMMIT ? "COMMIT MODE" : "DRY RUN"} — ${SITELINKS.length} sitelink(s) to create\n`)

  // Character limits validation
  const errors: string[] = []
  for (const s of SITELINKS) {
    if (s.linkText.length > 25) errors.push(`  Link text too long (${s.linkText.length}/25): "${s.linkText}"`)
    if (s.description1.length > 35) errors.push(`  Desc 1 too long (${s.description1.length}/35): "${s.description1}"`)
    if (s.description2.length > 35) errors.push(`  Desc 2 too long (${s.description2.length}/35): "${s.description2}"`)
  }
  if (errors.length > 0) {
    console.error("Character limit violations:")
    errors.forEach(e => console.error(e))
    process.exit(1)
  }

  // Preview
  for (const s of SITELINKS) {
    console.log(`  [${s.campaignName}]`)
    console.log(`    "${s.linkText}" → ${s.finalUrl}`)
    console.log(`    1: ${s.description1}`)
    console.log(`    2: ${s.description2}`)
    console.log()
  }

  if (!COMMIT) {
    console.log("(dry run — re-run with --commit to actually create)\n")
    return
  }

  // ── Step 1: Create asset resources ──────────────────────────────────────
  console.log("Creating sitelink assets...")
  const assetOps = SITELINKS.map(s => ({
    create: {
      sitelink_asset: {
        link_text: s.linkText,
        description1: s.description1,
        description2: s.description2,
      },
      final_urls: [s.finalUrl],
    },
  }))

  // @ts-expect-error — assets service typing in the library is loose but works
  const assetResponse = await customer.assets.create(assetOps.map(op => op.create))
  console.log(`  Created ${assetResponse.results?.length ?? 0} asset(s)`)

  // assetResponse.results is an array of { resource_name: "customers/X/assets/Y" }
  const resourceNames: string[] = (assetResponse.results ?? []).map((r: { resource_name: string }) => r.resource_name)

  if (resourceNames.length !== SITELINKS.length) {
    console.error(`✗ expected ${SITELINKS.length} results, got ${resourceNames.length}`)
    process.exit(1)
  }

  // ── Step 2: Link each asset to its campaign ─────────────────────────────
  console.log("\nLinking assets to campaigns...")
  const campaignAssetOps = SITELINKS.map((s, i) => ({
    campaign: campaigns.get(s.campaignName)!,
    asset: resourceNames[i]!,
    field_type: enums.AssetFieldType.SITELINK,
  }))

  // @ts-expect-error — same note on typing
  const linkResponse = await customer.campaignAssets.create(campaignAssetOps)
  console.log(`  Linked ${linkResponse.results?.length ?? 0} asset(s) to campaigns`)

  console.log("\n✓ Done. Sitelinks will appear under Campaigns → Assets → Sitelinks.")
  console.log("  They may take a few minutes to start serving in ads.")
}

main().catch(err => {
  console.error("\n✗ Failed:", err instanceof Error ? err.message : String(err))
  if (err && typeof err === "object" && "errors" in err) {
    console.error(JSON.stringify((err as { errors: unknown }).errors, null, 2))
  }
  process.exit(1)
})
