import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { getMockInsights, getCachedInsights } from '~/utils/metaApi'
import { SYSTEM_PROMPT, buildWeeklyPrompt } from '~/utils/agentPrompt'

export default defineEventHandler(async (event) => {
  // Auth check
  const session = getCookie(event, 'admin_session')
  if (session !== 'authenticated') {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  const body = await readBody(event)
  const config = useRuntimeConfig()

  // 1. Get insights (from cache or mock)
  const insights = getCachedInsights() || getMockInsights()

  // 2. Build prompt
  const systemPrompt = body.customPrompt || SYSTEM_PROMPT
  const userMessage = buildWeeklyPrompt(insights)

  // 3. Call Claude API
  if (!config.anthropicApiKey) {
    throw createError({ statusCode: 500, message: 'ANTHROPIC_API_KEY non configuré' })
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const firstBlock = message.content[0]
  const briefText = firstBlock?.type === 'text' ? firstBlock.text : ''

  const generatedAt = new Date().toISOString()

  // 4. Send email if requested
  if (body.action === 'email') {
    const resend = new Resend(config.resendApiKey)
    const targetEmail = config.briefEmail || config.emailTo

    const monday = getMondayDate()
    const subject = `📋 Brief Marketing — Semaine du ${monday}`

    await resend.emails.send({
      from: config.emailFrom || 'hello@chantalmasse.com',
      to: targetEmail,
      subject,
      html: buildBriefEmailHtml(briefText, monday),
    })
  }

  return { brief: briefText, generatedAt }
})

function getMondayDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildBriefEmailHtml(brief: string, weekDate: string): string {
  const escaped = brief
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf7f3;font-family:Manrope,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#173028;border-radius:16px;padding:32px;margin-bottom:24px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;margin:0 0 8px;font-style:italic;">Chantal Massé</h1>
      <p style="color:#cce9dd;margin:0;font-size:14px;">Brief Marketing IA</p>
    </div>
    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f0ebe4;">
      <h2 style="color:#173028;font-size:18px;margin:0 0 8px;">Semaine du ${weekDate}</h2>
      <p style="color:#727975;font-size:13px;margin:0 0 24px;">Généré automatiquement par l'agent IA</p>
      <div style="color:#1d1b19;font-size:15px;line-height:1.7;">${escaped}</div>
    </div>
    <p style="text-align:center;color:#a0a0a0;font-size:12px;margin-top:24px;">
      Chantal Massé — Thérapeute en relation d'aide · Shefford, Québec
    </p>
  </div>
</body>
</html>`
}
