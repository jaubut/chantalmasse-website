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

## Step 6 — Configure Environment Variables

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

# Booking config
BOOKING_TIMEZONE=America/Toronto
BOOKING_ADVANCE_DAYS=60
BOOKING_MIN_NOTICE_HOURS=24
```

> **Important:** When pasting the private key, keep the `\n` escape sequences exactly as they appear in the downloaded JSON file. Do NOT replace them with actual newlines.

---

## Step 7 — Vercel Deployment

In the Vercel project settings, add all environment variables from `.env` under **Settings → Environment Variables**.

The `GOOGLE_PRIVATE_KEY` value must be pasted with the `\n` escape sequences intact (do NOT use the Vercel multiline editor for this key — paste as a single line).

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
