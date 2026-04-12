import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = "465141726";
const client = new BetaAnalyticsDataClient({
  keyFilename: ".secrets/tls-analytics-sa-key.json",
});

async function runReport(
  name: string,
  dimensions: string[],
  metrics: string[],
  dateRange = { startDate: "2025-04-01", endDate: "2026-04-02" }
) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [dateRange],
    dimensions: dimensions.map((d) => ({ name: d })),
    metrics: metrics.map((m) => ({ name: m })),
    limit: 50,
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 ${name}`);
  console.log(`${"=".repeat(60)}`);

  const dimHeaders = response.dimensionHeaders?.map((h) => h.name) || [];
  const metHeaders = response.metricHeaders?.map((h) => h.name) || [];
  console.log([...dimHeaders, ...metHeaders].join("\t"));
  console.log("-".repeat(80));

  for (const row of response.rows || []) {
    const dims = row.dimensionValues?.map((d) => d.value) || [];
    const mets = row.metricValues?.map((m) => m.value) || [];
    console.log([...dims, ...mets].join("\t"));
  }

  console.log(`Total rows: ${response.rowCount}`);
}

async function main() {
  console.log("🔍 Chantal Massé — GA4 Audit (last 12 months)\n");

  // 1. Traffic overview by channel
  await runReport(
    "Traffic by Channel",
    ["sessionDefaultChannelGroup"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate", "averageSessionDuration"]
  );

  // 2. Traffic by source/medium
  await runReport(
    "Traffic by Source/Medium",
    ["sessionSourceMedium"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate"]
  );

  // 3. Paid vs Organic
  await runReport(
    "Paid Search — Campaigns",
    ["sessionCampaignName", "sessionGoogleAdsAdGroupName"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate", "averageSessionDuration"]
  );

  // 4. Landing pages
  await runReport(
    "Top Landing Pages",
    ["landingPage"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate", "averageSessionDuration"]
  );

  // 5. Geographic
  await runReport(
    "Traffic by City",
    ["city"],
    ["sessions", "totalUsers", "engagedSessions"]
  );

  // 6. Device
  await runReport(
    "Traffic by Device",
    ["deviceCategory"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate"]
  );

  // 7. Monthly trend
  await runReport(
    "Monthly Trend",
    ["yearMonth"],
    ["sessions", "totalUsers", "engagedSessions", "conversions"]
  );

  // 8. Conversions / events
  await runReport(
    "Key Events",
    ["eventName"],
    ["eventCount", "totalUsers"]
  );

  // 9. Pages
  await runReport(
    "Top Pages (pageviews)",
    ["pagePath"],
    ["screenPageViews", "totalUsers", "averageSessionDuration"]
  );

  // 10. New vs returning
  await runReport(
    "New vs Returning Users",
    ["newVsReturning"],
    ["sessions", "totalUsers", "engagedSessions", "bounceRate"]
  );
}

main().catch(console.error);
