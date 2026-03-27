import { BrevoClient } from '@getbrevo/brevo'

export default defineEventHandler(async (event) => {
  const { email, phone } = await readBody(event)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse courriel invalide.' })
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY!,
  })

  await client.contacts.createContact({
    email,
    updateEnabled: true,
    ...(phone ? { attributes: { SMS: phone } } : {}),
  })

  return { success: true }
})
