// One-time helper to grab a Google Ads API refresh_token.
//
// Pre-reqs:
//   1. In GCP Console (project `tls-analytics`), enable "Google Ads API" on the
//      service-enabled APIs list.
//   2. Create an OAuth 2.0 Client ID (type: "Desktop app"). Download the
//      client ID + client secret.
//   3. In your Google Ads MCC (hello@tech-lab.studio), go to Tools & Settings →
//      API Center. Copy the developer token (approve any pending access request
//      first — "Test Access" works for audits, "Basic Access" for production).
//   4. Make sure customer 690-251-4931 (Chantal) is LINKED under the MCC.
//
// Run:
//   GOOGLE_ADS_CLIENT_ID=... GOOGLE_ADS_CLIENT_SECRET=... bun scripts/ads-oauth-setup.ts
//
// The script will print a URL — open it, sign in with hello@tech-lab.studio,
// grant access to Google Ads, and paste back the code from the redirect URL.
// It will print a refresh_token you should add to .env.

import { createServer } from "http"
import { URL } from "url"

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET
const REDIRECT_URI = "http://127.0.0.1:8765/oauth/callback"
const SCOPE = "https://www.googleapis.com/auth/adwords"

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET env vars.")
  console.error("See the top of this file for setup steps.")
  process.exit(1)
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
authUrl.searchParams.set("client_id", CLIENT_ID)
authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
authUrl.searchParams.set("response_type", "code")
authUrl.searchParams.set("scope", SCOPE)
authUrl.searchParams.set("access_type", "offline")
authUrl.searchParams.set("prompt", "consent") // force refresh_token issuance

console.log("\n→ Open this URL in your browser, sign in with hello@tech-lab.studio:\n")
console.log(authUrl.toString())
console.log("\n(Waiting for the OAuth redirect on http://127.0.0.1:8765 ...)\n")

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth/callback")) {
    res.writeHead(404)
    res.end()
    return
  }

  const url = new URL(req.url, "http://127.0.0.1:8765")
  const code = url.searchParams.get("code")
  const err = url.searchParams.get("error")

  if (err) {
    res.writeHead(400, { "Content-Type": "text/plain" })
    res.end(`OAuth error: ${err}`)
    console.error("\nOAuth error:", err)
    server.close()
    process.exit(1)
  }
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" })
    res.end("Missing ?code")
    return
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })
  const data = (await tokenRes.json()) as { refresh_token?: string; error?: string }

  if (!data.refresh_token) {
    res.writeHead(500, { "Content-Type": "text/plain" })
    res.end(`No refresh_token in response: ${JSON.stringify(data)}`)
    console.error("\nNo refresh_token. Response:", data)
    server.close()
    process.exit(1)
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(`<html><body style="font-family:sans-serif;padding:40px"><h2>Done ✓</h2><p>Tu peux fermer cette fenêtre.</p></body></html>`)

  console.log("\n" + "=".repeat(60))
  console.log("✓ Refresh token obtained. Add this to .env:")
  console.log("=".repeat(60))
  console.log(`GOOGLE_ADS_REFRESH_TOKEN=${data.refresh_token}`)
  console.log("=".repeat(60) + "\n")

  server.close()
  process.exit(0)
})

server.listen(8765, "127.0.0.1")
