---
name: Admin Marketing Dashboard
description: Password-protected /admin marketing dashboard with Meta Graph API + Claude API brief generation
type: project
---

Full admin marketing dashboard added to the site at `/admin`.

**Why:** Internal tool for Chantal Massé to manage social media strategy using Meta insights and AI-generated weekly briefs.

**How to apply:** Admin pages use `layout: 'admin'` (layouts/admin.vue — no public nav/footer) and `middleware: 'admin'` (checks `admin_session` cookie). Never modify public pages when working on admin features.

## Files added
- `pages/admin/index.vue` — Login gate (no middleware, sets cookie on success)
- `pages/admin/dashboard.vue` — 4-tab dashboard (Aperçu, Brief, Architecture, Prompt)
- `middleware/admin.ts` — Protects /admin/* except /admin/index
- `layouts/admin.vue` — Admin layout (slot only, no public nav)
- `composables/useAdmin.ts` — Auth state, logout, fetchInsights, generateBrief
- `utils/metaApi.ts` — Meta API types, mock data, pillar detection, 15-min in-memory cache
- `utils/agentPrompt.ts` — SYSTEM_PROMPT constant + buildWeeklyPrompt()
- `server/api/admin/auth.post.ts` — Password check → sets httpOnly cookie
- `server/api/admin/meta-insights.get.ts` — Meta Graph API v19.0, falls back to mock data
- `server/api/admin/generate-brief.post.ts` — Calls Claude (claude-sonnet-4-6), optionally emails via Resend
- `server/api/admin/schedule.get.ts` — Phase 2 stub

## Env vars added (server-only runtimeConfig)
- `ADMIN_PASSWORD`, `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_FB_PAGE_ID`, `ANTHROPIC_API_KEY`, `BRIEF_EMAIL`

## Key behaviors
- No META_ACCESS_TOKEN → returns mock data with `isMockData: true` flag → UI shows setup banner
- Brief history stored in localStorage key `cm_briefs` (last 4)
- System prompt editable in Tab 4, saved to localStorage key `cm_system_prompt`
- Email brief uses Resend with existing `resendApiKey` + `emailFrom` from runtimeConfig
