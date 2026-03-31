import { schedules, logger } from '@trigger.dev/sdk/v3'
import { scrapeInstagram, generateBrief, sendBriefEmail, type BriefClientConfig } from '../server/utils/briefService'

/**
 * Weekly marketing brief for Chantal Massé.
 * Runs every Wednesday at 9:00 AM America/Toronto.
 *
 * To add a new client: trigger `chantalmasse-weekly-brief` ad-hoc with a custom payload,
 * OR duplicate this task with a new id + client config.
 *
 * Required env vars (set in Trigger.dev dashboard):
 *   CHANTAL_IG_USERNAME   — e.g. "chantalmasse_therapeute"
 *   BRIEF_EMAIL           — e.g. "chantal.gmasse@gmail.com"
 *   APIFY_API_TOKEN
 *   ANTHROPIC_API_KEY
 *   RESEND_API_KEY
 *   EMAIL_FROM
 */
export const weeklyBrief = schedules.task({
  id: 'chantalmasse-weekly-brief',
  cron: {
    pattern: '0 9 * * 3', // Every Wednesday at 9:00 AM
    timezone: 'America/Toronto',
  },
  // Give enough time for Apify scraping (up to 45s polling) + Claude + Resend
  maxDuration: 120,
  run: async (payload, { ctx }) => {
    logger.info('Starting weekly brief', { scheduledAt: payload.timestamp })

    const config: BriefClientConfig = {
      igUsername: process.env.CHANTAL_IG_USERNAME!,
      fbUsername: process.env.CHANTAL_FB_USERNAME,
      briefEmail: process.env.BRIEF_EMAIL!,
    }

    if (!config.igUsername) throw new Error('CHANTAL_IG_USERNAME env var is not set')
    if (!config.briefEmail) throw new Error('BRIEF_EMAIL env var is not set')

    // Step 1 — Scrape Instagram + Facebook
    logger.info('Scraping Instagram', { username: config.igUsername })
    const insights = await scrapeInstagram(config)
    logger.info('Scrape complete', {
      posts: insights.analytics.postsAnalyzed,
      igPosts: insights.analytics.igPosts,
      fbPosts: insights.analytics.fbPosts,
    })

    // Step 2 — Generate brief with Claude
    logger.info('Generating brief with Claude')
    const brief = await generateBrief(insights)
    logger.info('Brief generated', { length: brief.length })

    // Step 3 — Send email via Resend
    logger.info('Sending brief email', { to: config.briefEmail })
    await sendBriefEmail(brief, config)

    return {
      success: true,
      postsAnalyzed: insights.analytics.postsAnalyzed,
      briefLength: brief.length,
      sentTo: config.briefEmail,
    }
  },
})
