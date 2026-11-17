// Brand layout for every booking mail. Mirrors the newsletter layout in
// tls-dashboard-v2 (server/lib/chantal-email-layout.ts, PR #438): cream page,
// Newsreader italic wordmark, secondary-fixed pill eyebrow, serif headline,
// light Manrope body, slate-blue button, footer on surface-container-low.
// Tokens come from assets/css/main.css. The site has no dark theme, so the mail
// is locked to light. Tables and inline styles for the clients that drop <style>.
import { escapeHtml } from './input'

const SERIF = "Newsreader,Georgia,'Times New Roman',serif"
const SANS = "Manrope,'Helvetica Neue',Helvetica,Arial,sans-serif"
const BACKGROUND = '#fef8f3' // --color-background
const SURFACE_LOW = '#f8f3ee' // --color-surface-container-low (site footer)
const PRIMARY = '#173028' // --color-primary
const LEAD = 'rgba(23,48,40,0.8)' // text-primary/80
const BODY = '#424845' // --color-on-surface-variant
const MUTED = '#727975' // --color-outline
const RULE = '#e6e2dd' // --color-surface-container-highest
const PILL = '#dbe1ff' // --color-secondary-fixed
const BUTTON = '#515d85' // --color-secondary
const ON_BUTTON = '#ffffff' // --color-on-secondary

const SITE = 'https://chantalmasse.com'

export const headline = (html: string): string =>
  `<h1 class="cm-h1" style="margin:0 0 16px;font-family:${SERIF};font-weight:400;font-size:38px;line-height:1.1;letter-spacing:-0.02em;color:${PRIMARY}">${html}</h1>`

export const lead = (html: string): string =>
  `<p class="cm-lead" style="margin:0 0 28px;font-family:${SERIF};font-weight:400;font-size:22px;line-height:1.3;color:${PRIMARY};color:${LEAD}">${html}</p>`

export const paragraph = (html: string): string =>
  `<p class="cm-body" style="margin:0 0 18px;font-family:${SANS};font-weight:300;font-size:16px;line-height:1.6;color:${BODY}">${html}</p>`

export const link = (href: string, label: string): string =>
  `<a href="${href}" class="cm-link" style="color:${PRIMARY};text-decoration:underline">${label}</a>`

// Label over value, hairline between rows: no icons, no tinted panel (a tinted
// panel is what dark-mode clients turn muddy brown). Values are already escaped.
export function details(rows: Array<[label: string, valueHtml: string]>): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td class="cm-rule" style="padding:14px 0;border-top:1px solid ${RULE}">` +
        `<div class="cm-label" style="font-family:${SANS};font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;line-height:16px;color:${MUTED}">${label}</div>` +
        `<div class="cm-body" style="margin-top:2px;font-family:${SANS};font-size:16px;font-weight:500;line-height:1.5;color:${PRIMARY}">${value}</div>` +
        `</td></tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">${cells}<tr><td class="cm-rule" style="border-top:1px solid ${RULE};font-size:0;line-height:0">&nbsp;</td></tr></table>`
}

// Bulletproof full-width button: a padded cell for every client, VML for Outlook on Windows.
export function button(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:56px;v-text-anchor:middle;width:496px" arcsize="14%" stroke="f" fillcolor="${BUTTON}"><center style="color:${ON_BUTTON};font-family:Arial,sans-serif;font-size:16px;font-weight:bold">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" class="cm-btn" bgcolor="${BUTTON}" style="background:${BUTTON};border-radius:8px"><a href="${href}" class="cm-btn-link" style="display:block;padding:18px 32px;font-family:${SANS};font-size:16px;font-weight:600;line-height:20px;text-align:center;color:${ON_BUTTON};text-decoration:none;border-radius:8px">${label}</a></td></tr></table><!--<![endif]-->
</td></tr></table>`
}

const footerLink = (href: string, label: string): string =>
  `<a href="${href}" class="cm-foot" style="color:${BODY};text-decoration:underline">${label}</a>`

const FOOTER = `<p class="cm-foot" style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${BODY}">Chantal Massé Thérapeute · 245 rue Colette, Shefford (Québec) J2M 2B7<br>${footerLink('mailto:chantal.gmasse@gmail.com', 'chantal.gmasse@gmail.com')} · ${footerLink(SITE, 'chantalmasse.com')}</p>`

// Ask clients for light only, and undo Outlook.com's dark rewrite ([data-ogsc]
// text, [data-ogsb] backgrounds). Gmail's apps ignore both and may still invert.
const LOCK_CSS = `:root{color-scheme:light only;supported-color-schemes:light}
@media (max-width:480px){.cm-h1{font-size:32px !important}.cm-pad{padding:32px 20px 16px !important}.cm-foot-bg{padding-left:20px !important;padding-right:20px !important}}
[data-ogsb] .cm-bg{background-color:${BACKGROUND} !important}
[data-ogsb] .cm-foot-bg{background-color:${SURFACE_LOW} !important}
[data-ogsb] .cm-pill{background-color:${PILL} !important}
[data-ogsb] .cm-btn{background-color:${BUTTON} !important}
[data-ogsc] .cm-mark,[data-ogsc] .cm-h1,[data-ogsc] .cm-pill,[data-ogsc] .cm-link{color:${PRIMARY} !important}
[data-ogsc] .cm-lead{color:${LEAD} !important}
[data-ogsc] .cm-body,[data-ogsc] .cm-foot{color:${BODY} !important}
[data-ogsc] .cm-label{color:${MUTED} !important}
[data-ogsc] .cm-rule{border-color:${RULE} !important}
[data-ogsc] .cm-btn-link{color:${ON_BUTTON} !important}`

// `body` is trusted HTML assembled from the helpers above; callers escape values.
export function brandEmail(opts: { subject: string; preheader: string; eyebrow: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(opts.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;500;600&amp;family=Newsreader:ital,wght@0,400;1,400&amp;display=swap" rel="stylesheet">
<style>${LOCK_CSS}</style>
</head>
<body class="cm-bg" style="margin:0;padding:0;background:${BACKGROUND}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(opts.preheader)}</div>
<table role="presentation" class="cm-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BACKGROUND}" style="background:${BACKGROUND}"><tr><td align="center" class="cm-pad" style="padding:40px 24px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 0 40px"><a href="${SITE}" class="cm-mark" style="font-family:${SERIF};font-style:italic;font-size:24px;line-height:1.2;color:${PRIMARY};text-decoration:none">Chantal Massé</a></td></tr>
<tr><td>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px"><tr><td class="cm-pill" bgcolor="${PILL}" style="background:${PILL};border-radius:12px;padding:8px 16px;font-family:${SANS};font-size:12px;font-weight:500;line-height:16px;letter-spacing:0.1em;text-transform:uppercase;color:${PRIMARY}">${escapeHtml(opts.eyebrow)}</td></tr></table>
${opts.body}
</td></tr>
</table>
</td></tr>
<tr><td align="center" class="cm-foot-bg" bgcolor="${SURFACE_LOW}" style="background:${SURFACE_LOW};padding:32px 24px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px"><tr><td>
${FOOTER}
</td></tr></table>
</td></tr></table>
</body>
</html>`
}
