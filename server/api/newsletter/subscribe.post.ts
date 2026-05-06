import { BrevoClient } from '@getbrevo/brevo'
import { cleanText, isEmail } from '~/server/utils/input'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { email: rawEmail, phone: rawPhone } = await readBody(event)
  const email = cleanText(rawEmail, 254).toLowerCase()
  const phone = cleanText(rawPhone, 32)

  if (!email || !isEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse courriel invalide.' })
  }

  const listId = Number(config.brevoListId)
  const templateId = Number(config.brevoDoiTemplateId)
  if (!config.brevoApiKey || !Number.isInteger(listId) || !Number.isInteger(templateId)) {
    throw createError({
      statusCode: 503,
      statusMessage: 'L’inscription à l’infolettre est temporairement indisponible.',
    })
  }

  const client = new BrevoClient({ apiKey: config.brevoApiKey as string })

  await client.contacts.createDoiContact({
    email,
    includeListIds: [listId],
    templateId,
    redirectionUrl: `${config.siteBaseUrl}/inscription-confirmee`,
    ...(phone ? { attributes: { SMS: phone } } : {}),
  })

  return { success: true }
})
