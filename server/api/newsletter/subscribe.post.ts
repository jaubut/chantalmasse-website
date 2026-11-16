import { cleanText, isEmail } from '~/server/utils/input'
import { callNewsletterApi, newsletterError } from '~/server/utils/newsletterApi'
import { NEWSLETTER_CONSENT_VERSION } from '~/utils/newsletterConsent'

// The dashboard answers 202 for every valid address (new, subscribed, opted out,
// throttled or honeypot), so the form shows one neutral message.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = cleanText(body?.email, 254).toLowerCase()
  if (!email || !isEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse courriel invalide.' })
  }

  const res = await callNewsletterApi(event, 'subscribe', {
    email,
    consent_version: NEWSLETTER_CONSENT_VERSION,
    website: cleanText(body?.website, 200),
  })
  if (res.status === 202) return { success: true }
  if (res.status === 400) throw createError({ statusCode: 400, statusMessage: 'Adresse courriel invalide.' })
  newsletterError(res.status)
})
