// Refreshes "Thérapie individuelle" ad copy: the 6 existing RSAs are clones
// of one generic asset set (CTR 3.0% vs couple's 8.8%). Creates one new
// differentiated RSA per ad group (voice-doc anchored: visio/présentiel,
// Shefford, no-waitlist, real-time booking) and pauses the weakest clone in
// each group to respect the 3-RSA-per-ad-group cap.
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

const HEADLINES = [
  "Thérapie en Relation d'Aide",
  "Vidéo ou Présentiel, au Choix",
  "Rendez-Vous Cette Semaine",
  "Aucune Liste d'Attente",
  "Shefford, Cantons-de-l'Est",
  "Disponibilités en Temps Réel",
  "Choisis Ton Créneau en Ligne",
  "Une Écoute Sans Jugement",
  "Quand C'est le Moment",
  "Thérapeute à Shefford",
  "Séance de 60 Minutes",
  "Prendre Rendez-Vous",
]

const DESCRIPTIONS = [
  "Thérapie en relation d'aide à Shefford. Vidéo ou présentiel — tu choisis en réservant.",
  "Aucune attente de 3 semaines. Choisis ton créneau en ligne, c'est réglé en 2 minutes.",
  "Une écoute réelle, sans jargon ni jugement. Première séance disponible cette semaine.",
  "Réservation en ligne, disponibilités en temps réel, lien visio reçu immédiatement.",
]

interface Target {
  adGroupName: string
  adGroupRn: string
  pauseAdRn: string // weakest clone in the group (lowest CTR, 30d)
  finalUrl: string
}

const TARGETS: Target[] = [
  {
    adGroupName: "Page Rendez-vous",
    adGroupRn: "customers/6902514931/adGroups/167045185902",
    pauseAdRn: "customers/6902514931/adGroupAds/167045185902~719512327431", // 13/773 = 1.7% CTR
    finalUrl: "https://www.chantalmasse.com/prendre-rendez-vous",
  },
  {
    adGroupName: "Page Thérapie individuelle",
    adGroupRn: "customers/6902514931/adGroups/174492473270",
    pauseAdRn: "customers/6902514931/adGroupAds/174492473270~754002629934", // 5/174 = 2.9% CTR
    finalUrl: "https://www.chantalmasse.com/therapie-individuelle",
  },
]

// RSA hard limits: headlines ≤30 chars, descriptions ≤90 chars
for (const h of HEADLINES) {
  if (h.length > 30) {
    console.error(`✗ Headline over 30 chars (${h.length}): "${h}"`)
    process.exit(1)
  }
}
for (const d of DESCRIPTIONS) {
  if (d.length > 90) {
    console.error(`✗ Description over 90 chars (${d.length}): "${d}"`)
    process.exit(1)
  }
}

console.log(`\n${COMMIT ? "COMMIT" : "DRY RUN"} — refresh Thérapie individuelle copy\n`)
for (const t of TARGETS) {
  console.log(`  ${t.adGroupName}`)
  console.log(`    → pause weakest clone: ${t.pauseAdRn.split("~")[1]}`)
  console.log(`    → create new RSA → ${t.finalUrl}`)
}
console.log(`\n  ${HEADLINES.length} headlines / ${DESCRIPTIONS.length} descriptions per new RSA`)

if (!COMMIT) {
  console.log("\n(dry run — re-run with --commit to actually apply)\n")
  process.exit(0)
}

for (const t of TARGETS) {
  console.log(`\n${t.adGroupName}:`)

  // 1. Pause the weakest clone first (frees the 3-RSA slot)
  // @ts-expect-error — service typings are loose
  await customer.adGroupAds.update([{ resource_name: t.pauseAdRn, status: "PAUSED" }])
  console.log(`  ✓ Paused ${t.pauseAdRn.split("~")[1]}`)

  // 2. Create the new differentiated RSA
  // @ts-expect-error — same loose typings
  const created = await customer.adGroupAds.create([
    {
      ad_group: t.adGroupRn,
      status: "ENABLED",
      ad: {
        final_urls: [t.finalUrl],
        responsive_search_ad: {
          headlines: HEADLINES.map((text) => ({ text })),
          descriptions: DESCRIPTIONS.map((text) => ({ text })),
          path1: "therapie",
          path2: "individuelle",
        },
      },
    },
  ])
  const rn = created.results?.[0]?.resource_name ?? "?"
  console.log(`  ✓ Created RSA: ${rn}`)
}

console.log("\n✓ Done. New RSAs enter review (typically <1 business day), then serve.")
console.log("  Rollback: re-enable the paused ads + pause the new ones.")
