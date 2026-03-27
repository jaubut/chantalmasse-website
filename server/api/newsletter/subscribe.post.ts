import { BrevoClient } from '@getbrevo/brevo'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse courriel invalide.' })
  }

  const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY!,
  })

  await client.contacts.createContact({
    email,
    updateEnabled: true,
  })

  return { success: true }
})
