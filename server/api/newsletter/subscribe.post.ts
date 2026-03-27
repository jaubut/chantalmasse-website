import { BrevoClient } from '@getbrevo/brevo'

export default defineEventHandler(async (event) => {
  const { email, phone } = await readBody(event)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse courriel invalide.' })
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY!,
  })

  await client.contacts.createDoiContact({
    email,
    includeListIds: [Number(process.env.BREVO_LIST_ID)],
    templateId: Number(process.env.BREVO_DOI_TEMPLATE_ID),
    redirectionUrl: `${process.env.NUXT_PUBLIC_SITE_URL}/inscription-confirmee`,
    ...(phone ? { attributes: { SMS: phone } } : {}),
  })

  return { success: true }
})
