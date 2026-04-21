# Booking System — Google Cloud Setup

## Overview

This site uses Google Calendar API (service account) for availability checking and event creation, and Resend for transactional emails.

---

## Step 1 — Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **Select a project** → **New Project**
3. Name it `chantalmasse-booking`, click **Create**

---

## Step 2 — Enable Required APIs

1. In the project, go to **APIs & Services → Library**
2. Search and enable:
   - **Google Calendar API**
3. Google Meet is automatically available through Calendar (no separate enable needed)

---

## Step 3 — Create a Service Account

Service accounts allow server-to-server access without OAuth user flow.

1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Name: `calendly-bot` → click **Create and Continue**
4. Role: **Project → Editor** (or a custom minimal Calendar role) → **Continue → Done**
5. Click the newly created service account → **Keys** tab
6. **Add Key → Create New Key → JSON** → download the file
7. Open the JSON file — you'll need:
   - `client_email` → this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → this is your `GOOGLE_PRIVATE_KEY`

---

## Step 4 — Share Chantal's Calendar with the Service Account

1. Open **Google Calendar** (calendar.google.com) as Chantal
2. Find the calendar to use for appointments (usually the primary calendar)
3. Click the three dots → **Settings and sharing**
4. Under **Share with specific people**, add the service account email (e.g. `calendly-bot@chantalmasse-booking.iam.gserviceaccount.com`)
5. Permission: **Make changes to events**
6. Click **Send** (no actual invite email is sent to service accounts)
7. Note the **Calendar ID** shown under **Integrate calendar** → this is your `GOOGLE_CALENDAR_ID`

---

## Step 5 — Set Up Resend

1. Go to https://resend.com and create an account
2. **Domains** → add and verify `chantalmasse.com`
3. **API Keys** → Create API Key → copy it → this is `RESEND_API_KEY`
4. Sending domain: `reservations@chantalmasse.com` → set as `EMAIL_FROM`
5. Therapist notification recipient: `chantal@chantalmasse.com` → set as `EMAIL_TO`

---

## Step 6 — Set Up Twilio (SMS Reminders)

Used for the opt-in confirmation + 24h-before SMS to clients.

1. Go to https://www.twilio.com/try-twilio and create a fresh account
2. Verify your Canadian identity + add a payment method (pay-as-you-go, ~$0.008 per SMS to Canada; small trial credit is provided)
3. **Phone Numbers → Buy a Number** → filter by Country: Canada, Area Code: `450` (matches Shefford) → pick a local number → copy the E.164 value (e.g. `+14505551234`) → this is `TWILIO_FROM_NUMBER`
4. Top-right account dropdown → **Account Info** → copy:
   - **Account SID** → this is `TWILIO_ACCOUNT_SID`
   - **Auth Token** → this is `TWILIO_AUTH_TOKEN`
5. (Optional, recommended) In **Messaging → Services**, create a Messaging Service with the number pooled for delivery resilience. Not required for MVP.

> CASL note: the booking form shows an explicit opt-in checkbox ("Recevoir une confirmation par SMS et un rappel 24h avant la séance"). No SMS is sent unless the client ticks it.

---

## Step 7 — Configure Environment Variables

Create a `.env` file at the project root (never commit this file):

```bash
# Google Calendar API (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=calendly-bot@chantalmasse-booking.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=chantal@chantalmasse.com

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=reservations@chantalmasse.com
EMAIL_TO=chantal@chantalmasse.com

# Twilio (SMS confirmation + 24h reminder)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+14505551234

# Booking config
SITE_BASE_URL=https://chantalmasse.com
BOOKING_TIMEZONE=America/Toronto
BOOKING_ADVANCE_DAYS=60
BOOKING_MIN_NOTICE_HOURS=24
```

> **Important:** When pasting the private key, keep the `\n` escape sequences exactly as they appear in the downloaded JSON file. Do NOT replace them with actual newlines.

---

## Step 8 — Vercel Deployment

In the Vercel project settings, add all environment variables from `.env` under **Settings → Environment Variables**.

The `GOOGLE_PRIVATE_KEY` value must be pasted with the `\n` escape sequences intact (do NOT use the Vercel multiline editor for this key — paste as a single line).

---

## Step 9 — Trigger.dev (24h Reminder Cron)

The hourly reminder scan runs in Trigger.dev, independently of Vercel. It needs its own copy of the credentials.

1. Open your project at https://cloud.trigger.dev
2. **Environments → Production → Environment Variables**
3. Add every variable that the `trigger/booking-reminder.ts` task reads:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` (same `\n`-escaped format as Vercel)
   - `GOOGLE_CALENDAR_ID`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER`
   - `SITE_BASE_URL`
4. Redeploy the task (`bunx trigger.dev@latest deploy`) so it picks up the new SMS code path.

---

## Deployment Notes

- The site uses the `vercel` preset (not `vercel-static`) because API routes are required for booking functionality. Page routes are pre-rendered statically at build time.
- The `/api/booking/availability` response is cached in-memory for 5 minutes per month/service to reduce Google API calls.
- Cancellation (phase 2) generates a unique `cancelToken` per booking that can be used to cancel via `/api/booking/cancel`.

---

## Local Development

```bash
cp .env.example .env
# Fill in .env with real credentials (or use test values)
npm run dev
```

The booking modal will open when clicking any "Prendre rendez-vous" or "Réserver une séance" button. API routes are available at `http://localhost:3000/api/booking/`.

---

## Configuration Meta Graph API

### Step 1 — Create a Meta App

1. Go to https://developers.facebook.com
2. Click **My Apps → Create App**
3. Type: **Business** → give it a name → **Create App**
4. Add products: **Instagram Graph API** + **Pages API**

### Step 2 — Generate a Long-Lived Access Token

1. Open the **Graph API Explorer** in the developer portal
2. Select your App and your Facebook Page
3. Request permissions:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_read_engagement`
   - `pages_show_list`
4. Click **Generate Access Token**
5. Exchange for a long-lived token (valid 60 days):
   ```
   GET /oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_LIVED_TOKEN}
   ```

### Step 3 — Get Your Instagram User ID

```
GET /me/accounts → find your page
GET /{page-id}?fields=instagram_business_account
```
The `instagram_business_account.id` is your `META_IG_USER_ID`.

### Step 4 — Add to `.env`

```bash
META_ACCESS_TOKEN=your_long_lived_page_access_token
META_IG_USER_ID=your_instagram_business_account_id
META_FB_PAGE_ID=your_facebook_page_id
```

> **Note:** Long-lived tokens expire after 60 days. For production, implement a token refresh endpoint before expiry via the `fb_exchange_token` flow.

### Admin Dashboard

Once configured, access the admin dashboard at `/admin`:
- Default password: set `ADMIN_PASSWORD` in `.env`
- Tab 1: Real-time Meta insights (last 7 days)
- Tab 2: AI-generated weekly content brief via Claude API
- Tab 3: System architecture overview
- Tab 4: Editable Claude system prompt
