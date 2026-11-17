import { escapeAttribute, escapeHtml, stripHeaderValue } from './input'
import { brandEmail, button, details, headline, lead, link, paragraph } from './emailLayout'

const SITE = 'https://chantalmasse.com'

const locationLine = (sessionType: 'in-person' | 'video'): string =>
  sessionType === 'video' ? 'En visioconférence (Google Meet)' : 'En personne — Shefford, QC'

export function clientConfirmationEmail(params: {
  firstName: string
  service: string
  date: string
  time: string
  sessionType: 'in-person' | 'video'
  meetLink?: string
  cancelToken: string
}): { subject: string; html: string } {
  const subject = 'Ton rendez-vous avec Chantal Massé est confirmé'
  const firstName = escapeHtml(params.firstName)
  const meetLink = params.meetLink ? escapeAttribute(params.meetLink) : ''
  const cancelToken = encodeURIComponent(params.cancelToken)

  const meetButton =
    params.sessionType === 'video' && params.meetLink ? button(meetLink, 'Rejoindre la séance Google Meet') : ''

  const body = [
    headline('Ton rendez-vous est <em>confirmé</em>.'),
    lead(`Bonjour ${firstName}, j’ai bien noté ton rendez-vous.`),
    details([
      ['Service', escapeHtml(params.service)],
      ['Date', escapeHtml(params.date)],
      ['Heure', escapeHtml(params.time)],
      ['Format', locationLine(params.sessionType)],
    ]),
    meetButton,
    paragraph('Je t’écris la veille pour te le rappeler.'),
    paragraph(
      `Un empêchement&nbsp;? ${link(`${SITE}/annuler?token=${cancelToken}`, 'Annule ton rendez-vous')}, puis choisis un autre moment.`,
    ),
  ].join('\n')

  return { subject, html: brandEmail({ subject, preheader: `${params.date}, ${params.time}`, eyebrow: 'Rendez-vous confirmé', body }) }
}

export function clientCancellationEmail(params: {
  firstName: string
  service: string
  date: string
  time: string
}): { subject: string; html: string } {
  const subject = 'Ton rendez-vous avec Chantal Massé est annulé'
  const firstName = escapeHtml(params.firstName)

  const body = [
    headline('Ton rendez-vous est <em>annulé</em>.'),
    lead(`${firstName}, j’ai retiré cette séance de mon calendrier. Tu n’as rien d’autre à faire.`),
    details([
      ['Service', escapeHtml(params.service)],
      ['Date', escapeHtml(params.date)],
      ['Heure', escapeHtml(params.time)],
    ]),
    paragraph('Quand tu seras prêt·e, tu peux choisir un autre moment.'),
    button(`${SITE}/prendre-rendez-vous`, 'Choisir un autre moment'),
  ].join('\n')

  return { subject, html: brandEmail({ subject, preheader: 'Cette séance a été retirée du calendrier.', eyebrow: 'Rendez-vous annulé', body }) }
}

export function therapistCancellationEmail(params: {
  clientName: string
  clientEmail: string
  clientPhone?: string
  service: string
  date: string
  time: string
}): { subject: string; html: string } {
  const subject = stripHeaderValue(`Annulation — ${params.clientName} · ${params.date}`, 160)
  const clientName = escapeHtml(params.clientName)
  const clientEmail = escapeHtml(params.clientEmail)
  const clientEmailAttr = escapeAttribute(params.clientEmail)

  const rows: Array<[string, string]> = [
    ['Service', escapeHtml(params.service)],
    ['Date', escapeHtml(params.date)],
    ['Heure', escapeHtml(params.time)],
    ['Courriel', link(`mailto:${clientEmailAttr}`, clientEmail)],
  ]
  if (params.clientPhone) rows.push(['Téléphone', escapeHtml(params.clientPhone)])

  const body = [
    headline('Une séance <em>annulée</em>.'),
    lead(`${clientName} vient d’annuler sa séance.`),
    details(rows),
    paragraph('L’événement a été retiré de ton Google Agenda.'),
  ].join('\n')

  return { subject, html: brandEmail({ subject, preheader: `${params.clientName}, ${params.date} ${params.time}`, eyebrow: 'Annulation', body }) }
}

export function clientReminderEmail(params: {
  firstName: string
  service: string
  date: string
  time: string
  sessionType: 'in-person' | 'video'
  meetLink?: string
  cancelToken: string
}): { subject: string; html: string } {
  const subject = 'Rappel — Ton rendez-vous avec Chantal demain'
  // Manual Calendar bookings do not always yield a usable first name; greeting
  // someone by a placeholder is worse than greeting them by nothing.
  const firstName = escapeHtml(params.firstName || '')
  const greeting = firstName ? `Bonjour ${firstName}, je te rappelle ton rendez-vous.` : 'Je te rappelle ton rendez-vous.'
  const meetLink = params.meetLink ? escapeAttribute(params.meetLink) : ''
  const cancelToken = encodeURIComponent(params.cancelToken)

  const meetButton =
    params.sessionType === 'video' && params.meetLink ? button(meetLink, 'Rejoindre la séance Google Meet') : ''

  // Manual (Calendar-entered) bookings have no cancel token — only render the
  // self-serve cancel link when a real token exists, otherwise it points at
  // /annuler?token=undefined.
  const cancelBlock = params.cancelToken
    ? paragraph(
        `Un empêchement&nbsp;? ${link(`${SITE}/annuler?token=${cancelToken}`, 'Annule ton rendez-vous')}, puis choisis un autre moment.`,
      )
    : ''

  const body = [
    headline('On se voit <em>demain</em>.'),
    lead(greeting),
    details([
      ['Service', escapeHtml(params.service)],
      ['Date', escapeHtml(params.date)],
      ['Heure', escapeHtml(params.time)],
      ['Format', locationLine(params.sessionType)],
    ]),
    meetButton,
    cancelBlock,
  ].join('\n')

  return { subject, html: brandEmail({ subject, preheader: `${params.date}, ${params.time}`, eyebrow: 'Rappel', body }) }
}

export function therapistNotificationEmail(params: {
  clientName: string
  clientEmail: string
  clientPhone?: string
  service: string
  date: string
  time: string
  sessionType: 'in-person' | 'video'
  message?: string
  meetLink?: string
  eventId?: string
}): { subject: string; html: string } {
  const subject = stripHeaderValue(`Nouvelle réservation — ${params.clientName}`, 160)
  const clientName = escapeHtml(params.clientName)
  const clientEmail = escapeHtml(params.clientEmail)
  const clientEmailAttr = escapeAttribute(params.clientEmail)
  const meetLink = params.meetLink ? escapeAttribute(params.meetLink) : ''

  const rows: Array<[string, string]> = [
    ['Client', clientName],
    ['Courriel', link(`mailto:${clientEmailAttr}`, clientEmail)],
  ]
  if (params.clientPhone) rows.push(['Téléphone', escapeHtml(params.clientPhone)])
  rows.push(
    ['Service', escapeHtml(params.service)],
    ['Date', escapeHtml(params.date)],
    ['Heure', escapeHtml(params.time)],
    ['Format', locationLine(params.sessionType)],
  )
  if (params.sessionType === 'video' && params.meetLink) rows.push(['Lien Meet', link(meetLink, meetLink)])
  if (params.message) rows.push(['Message', escapeHtml(params.message).replace(/\n/g, '<br>')])

  const body = [
    headline('Nouvelle <em>réservation</em>.'),
    lead(`${clientName} a réservé une séance.`),
    details(rows),
    button('https://calendar.google.com', 'Voir dans Google Agenda'),
  ].join('\n')

  return { subject, html: brandEmail({ subject, preheader: `${params.clientName}, ${params.date} ${params.time}`, eyebrow: 'Nouvelle réservation', body }) }
}
