import { escapeAttribute, escapeHtml, stripHeaderValue } from './input'

export function clientConfirmationEmail(params: {
  firstName: string
  service: string
  date: string
  time: string
  sessionType: 'in-person' | 'video'
  meetLink?: string
  cancelToken: string
}): { subject: string; html: string } {
  const subject = 'Confirmation — Votre séance avec Chantal Massé'
  const firstName = escapeHtml(params.firstName)
  const service = escapeHtml(params.service)
  const date = escapeHtml(params.date)
  const time = escapeHtml(params.time)
  const meetLink = params.meetLink ? escapeAttribute(params.meetLink) : ''
  const cancelToken = encodeURIComponent(params.cancelToken)

  const locationLine =
    params.sessionType === 'video'
      ? 'En visioconférence (Google Meet)'
      : 'En personne — Shefford, QC'

  const meetButton =
    params.sessionType === 'video' && params.meetLink
      ? `
      <div style="text-align:center; margin: 32px 0;">
        <a href="${meetLink}" style="
          display:inline-block;
          background:#173028;
          color:#ffffff;
          padding:16px 32px;
          border-radius:8px;
          font-family:sans-serif;
          font-weight:600;
          font-size:16px;
          text-decoration:none;
        ">Rejoindre la séance Google Meet →</a>
      </div>`
      : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#173028;padding:40px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Chantal Massé</div>
            <div style="font-size:14px;color:#cce9dd;margin-top:6px;">Thérapeute en relation d'aide</div>
          </td>
        </tr>

        <!-- Checkmark -->
        <tr>
          <td style="padding:48px 40px 24px;text-align:center;">
            <div style="font-size:64px;color:#3D9970;">✓</div>
            <h1 style="font-size:28px;color:#173028;margin:16px 0 8px;font-style:italic;">Votre séance est confirmée!</h1>
            <p style="color:#424845;margin:0;">Bonjour ${firstName}, nous avons bien enregistré votre rendez-vous.</p>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede8;border-radius:12px;padding:24px;">
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">📋 Service :</strong> ${service}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">📅 Date :</strong> ${date}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">🕐 Heure :</strong> ${time}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">📍 Format :</strong> ${locationLine}
              </td></tr>
            </table>
          </td>
        </tr>

        ${meetButton}

        <!-- Reminder -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#cce9dd;border-radius:12px;padding:20px;text-align:center;font-size:14px;color:#173028;">
              ⏰ Un rappel vous sera envoyé 24h avant votre séance
            </div>
          </td>
        </tr>

        <!-- Cancel link -->
        <tr>
          <td style="padding:0 40px 40px;text-align:center;">
            <p style="font-size:13px;color:#727975;">
              Besoin d'annuler?
              <a href="https://chantalmasse.com/annuler?token=${cancelToken}" style="color:#173028;">Cliquez ici</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fef8f3;padding:24px 40px;text-align:center;border-top:1px solid #e6e2dd;">
            <p style="font-size:13px;color:#727975;margin:0;">
              <a href="https://chantalmasse.com" style="color:#173028;text-decoration:none;">chantalmasse.com</a>
              &nbsp;·&nbsp; Membre RITMA &nbsp;·&nbsp; Shefford, QC
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}

export function clientCancellationEmail(params: {
  firstName: string
  service: string
  date: string
  time: string
}): { subject: string; html: string } {
  const subject = 'Annulation confirmée — Séance avec Chantal Massé'
  const firstName = escapeHtml(params.firstName)
  const service = escapeHtml(params.service)
  const date = escapeHtml(params.date)
  const time = escapeHtml(params.time)

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

        <tr>
          <td style="background:#173028;padding:40px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Chantal Massé</div>
            <div style="font-size:14px;color:#cce9dd;margin-top:6px;">Thérapeute en relation d'aide</div>
          </td>
        </tr>

        <tr>
          <td style="padding:48px 40px 24px;text-align:center;">
            <h1 style="font-size:26px;color:#173028;margin:0 0 12px;font-style:italic;">Rendez-vous annulé, ${firstName}.</h1>
            <p style="color:#424845;margin:0;">La séance suivante a été retirée du calendrier. Aucune action supplémentaire de votre part.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede8;border-radius:12px;padding:24px;">
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">Service :</strong> ${service}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">Date :</strong> ${date}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">Heure :</strong> ${time}
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 40px;text-align:center;">
            <p style="font-size:14px;color:#424845;margin:0 0 20px;">Envie de reprendre un autre moment&nbsp;?</p>
            <a href="https://chantalmasse.com/prendre-rendez-vous" style="display:inline-block;background:#173028;color:#ffffff;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">Réserver une nouvelle séance →</a>
          </td>
        </tr>

        <tr>
          <td style="background:#fef8f3;padding:24px 40px;text-align:center;border-top:1px solid #e6e2dd;">
            <p style="font-size:13px;color:#727975;margin:0;">
              <a href="https://chantalmasse.com" style="color:#173028;text-decoration:none;">chantalmasse.com</a>
              &nbsp;·&nbsp; Membre RITMA &nbsp;·&nbsp; Shefford, QC
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
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
  const clientPhone = params.clientPhone ? escapeHtml(params.clientPhone) : ''
  const service = escapeHtml(params.service)
  const date = escapeHtml(params.date)
  const time = escapeHtml(params.time)

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:sans-serif;">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background:#8b1a1a;padding:24px 32px;">
        <div style="font-size:18px;font-weight:700;color:#ffffff;">Annulation de rendez-vous</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#1d1b19;"><strong>${clientName}</strong> vient d'annuler sa séance.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede8;border-radius:8px;padding:16px;">
          <tr><td style="padding:4px 0;font-size:14px;color:#1d1b19;"><strong>Service :</strong> ${service}</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#1d1b19;"><strong>Date :</strong> ${date}</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#1d1b19;"><strong>Heure :</strong> ${time}</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#1d1b19;"><strong>Courriel :</strong> <a href="mailto:${clientEmailAttr}" style="color:#173028;">${clientEmail}</a></td></tr>
          ${clientPhone ? `<tr><td style="padding:4px 0;font-size:14px;color:#1d1b19;"><strong>Téléphone :</strong> ${clientPhone}</td></tr>` : ''}
        </table>
        <p style="margin:16px 0 0;font-size:13px;color:#727975;">L'événement a été retiré de ton Google Calendar.</p>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
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
  const subject = 'Rappel — Votre séance avec Chantal demain'
  const firstName = escapeHtml(params.firstName)
  const service = escapeHtml(params.service)
  const date = escapeHtml(params.date)
  const time = escapeHtml(params.time)
  const meetLink = params.meetLink ? escapeAttribute(params.meetLink) : ''
  const cancelToken = encodeURIComponent(params.cancelToken)

  const locationLine =
    params.sessionType === 'video'
      ? 'En visioconférence (Google Meet)'
      : 'En personne — Shefford, QC'

  const meetButton =
    params.sessionType === 'video' && params.meetLink
      ? `
      <div style="text-align:center; margin: 32px 0;">
        <a href="${meetLink}" style="
          display:inline-block;
          background:#173028;
          color:#ffffff;
          padding:16px 32px;
          border-radius:8px;
          font-family:sans-serif;
          font-weight:600;
          font-size:16px;
          text-decoration:none;
        ">Rejoindre la séance Google Meet →</a>
      </div>`
      : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#173028;padding:40px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Chantal Massé</div>
            <div style="font-size:14px;color:#cce9dd;margin-top:6px;">Thérapeute en relation d'aide</div>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:48px 40px 24px;text-align:center;">
            <div style="font-size:48px;">⏰</div>
            <h1 style="font-size:28px;color:#173028;margin:16px 0 8px;font-style:italic;">On se voit demain, ${firstName}.</h1>
            <p style="color:#424845;margin:0;">Un petit rappel pour votre séance.</p>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede8;border-radius:12px;padding:24px;">
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">📋 Service :</strong> ${service}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">📅 Date :</strong> ${date}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">🕐 Heure :</strong> ${time}
              </td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;">
                <strong style="color:#173028;">📍 Format :</strong> ${locationLine}
              </td></tr>
            </table>
          </td>
        </tr>

        ${meetButton}

        <!-- Cancel link -->
        <tr>
          <td style="padding:0 40px 40px;text-align:center;">
            <p style="font-size:13px;color:#727975;">
              Un empêchement?
              <a href="https://chantalmasse.com/annuler?token=${cancelToken}" style="color:#173028;">Annuler ou reporter</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fef8f3;padding:24px 40px;text-align:center;border-top:1px solid #e6e2dd;">
            <p style="font-size:13px;color:#727975;margin:0;">
              <a href="https://chantalmasse.com" style="color:#173028;text-decoration:none;">chantalmasse.com</a>
              &nbsp;·&nbsp; Membre RITMA &nbsp;·&nbsp; Shefford, QC
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
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
  const subject = stripHeaderValue(`🗓 Nouvelle réservation — ${params.clientName}`, 160)
  const clientName = escapeHtml(params.clientName)
  const clientEmail = escapeHtml(params.clientEmail)
  const clientEmailAttr = escapeAttribute(params.clientEmail)
  const clientPhone = params.clientPhone ? escapeHtml(params.clientPhone) : ''
  const service = escapeHtml(params.service)
  const date = escapeHtml(params.date)
  const time = escapeHtml(params.time)
  const message = params.message ? escapeHtml(params.message).replace(/\n/g, '<br>') : ''
  const meetLink = params.meetLink ? escapeAttribute(params.meetLink) : ''

  const sessionLabel =
    params.sessionType === 'video'
      ? 'En visioconférence (Google Meet)'
      : 'En personne — Shefford, QC'

  const meetRow =
    params.sessionType === 'video' && params.meetLink
      ? `<tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">🔗 Lien Meet :</strong> <a href="${meetLink}" style="color:#173028;">${meetLink}</a></td></tr>`
      : ''

  const messageRow = params.message
    ? `<tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">💬 Message :</strong> ${message}</td></tr>`
    : ''

  const phoneRow = params.clientPhone
    ? `<tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">📞 Téléphone :</strong> ${clientPhone}</td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

        <tr>
          <td style="background:#173028;padding:32px 40px;">
            <div style="font-size:18px;font-weight:700;color:#ffffff;">🗓 Nouvelle réservation reçue</div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede8;border-radius:12px;padding:24px;">
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">👤 Client :</strong> ${clientName}</td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">✉️ Courriel :</strong> <a href="mailto:${clientEmailAttr}" style="color:#173028;">${clientEmail}</a></td></tr>
              ${phoneRow}
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">📋 Service :</strong> ${service}</td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">📅 Date :</strong> ${date}</td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">🕐 Heure :</strong> ${time}</td></tr>
              <tr><td style="padding:8px 0;font-size:15px;color:#1d1b19;"><strong style="color:#173028;">📍 Format :</strong> ${sessionLabel}</td></tr>
              ${meetRow}
              ${messageRow}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 40px;text-align:center;">
            <a href="https://calendar.google.com" style="
              display:inline-block;
              background:#173028;
              color:#ffffff;
              padding:12px 24px;
              border-radius:8px;
              font-size:14px;
              text-decoration:none;
              font-weight:600;
            ">Voir dans Google Agenda →</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
