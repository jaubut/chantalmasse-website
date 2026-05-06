import { cleanMultilineText, cleanText, escapeHtml, isEmail, stripHeaderValue } from '~/server/utils/input'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const name = cleanText(body?.name, 120)
  const contact = cleanText(body?.contact, 160)
  const message = cleanMultilineText(body?.message, 4000)
  const website = cleanText(body?.website, 200)

  if (!name || !contact || !message) {
    throw createError({ statusCode: 400, statusMessage: 'Tous les champs sont requis.' })
  }
  if (website) {
    return { ok: true }
  }
  if (!config.resendApiKey || !config.emailFrom || !config.emailTo) {
    throw createError({ statusCode: 503, statusMessage: 'Le formulaire est temporairement indisponible.' })
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2 style="color: #173028; margin-bottom: 16px;">Nouveau message — chantalmasse.com</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #555; width: 120px;">Nom</td>
          <td style="padding: 8px 12px;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #555;">Contact</td>
          <td style="padding: 8px 12px;">${escapeHtml(contact)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #555; vertical-align: top;">Message</td>
          <td style="padding: 8px 12px; white-space: pre-wrap;">${escapeHtml(message)}</td>
        </tr>
      </table>
    </div>
  `

  await $fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      from: config.emailFrom,
      to: config.emailTo,
      subject: stripHeaderValue(`Nouveau message de ${name}`, 160),
      html,
      reply_to: isEmail(contact) ? contact : undefined,
    },
  })

  return { ok: true }
})
