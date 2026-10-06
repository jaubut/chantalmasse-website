import {
  classifySession, extractPatientName, greetingName, resolveGuestEmails,
} from '../server/utils/chantalSessionRules'

let pass = 0, fail = 0
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++ } else { fail++; console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`) }
}

const S = (summary: string, durationMin = 60, extra: Record<string, unknown> = {}) =>
  classifySession({ summary, durationMin, startDateTime: '2026-09-14T10:00:00-04:00', ...extra }).session

console.log('--- real séance titles from chantal_billed_events must be sessions ---')
for (const t of [
  'Coaching de couple-Ronald Bonheur', 'Anne Boutin', 'Coahing de couple-Caroline tardif',
  'Annie-Pier Legault', 'Annie -Pier legault', 'Séance — Milane Cirnigliaro',
  'Coach de Couple for Donat +14382744795', 'Thérapie Individuelle for Anne Boutin +15148917262',
  'Thérapie ind-Patrice Gervais', 'Sandra Morisseau — couple', 'Xavier Rémy Garcia',
  'CATHERINE LALIBERTE', 'Zoé Tringle', 'Mélissa St-Onge', 'William Racine',
]) eq(`session: ${t}`, S(t), true)

console.log('--- blocks and non-sessions must be skipped ---')
for (const t of ['Plage bloquée', 'Pause diné', 'Vacances', 'annulé - Marie', 'No show Julie',
                 'No-show', 'Admin', 'Perso', 'Libre', 'CM note']) eq(`block: ${t}`, S(t), false)
eq('short event', S('Anne Boutin', 15), false)
eq('all-day', classifySession({ summary: 'Anne Boutin', durationMin: 60, startDateTime: '2026-08-01' }).session, false)
eq('no start', classifySession({ summary: 'Anne Boutin', durationMin: 60, startDateTime: null }).session, false)
eq('cancelled', S('Anne Boutin', 60, { status: 'cancelled' }), false)
eq('empty title', S('   '), false)

console.log('--- patient name extraction ---')
const names: [string, string][] = [
  ['Coaching de couple-Ronald Bonheur', 'Ronald Bonheur'],
  ['Coahing de couple-Caroline tardif', 'Caroline tardif'],
  ['Thérapie ind-Patrice Gervais', 'Patrice Gervais'],
  ['Thérapie Individuelle for Anne Boutin +15148917262', 'Anne Boutin'],
  ['Coach de Couple for Donat +14382744795', 'Donat'],
  ['Séance — Milane Cirnigliaro', 'Milane Cirnigliaro'],
  ['Sandra Morisseau — couple', 'Sandra Morisseau'],
  ['Annie-Pier Legault', 'Annie-Pier Legault'],
  ['Anne Boutin', 'Anne Boutin'],
]
for (const [inp, want] of names) eq(`name: ${inp}`, extractPatientName(inp), want)

console.log('--- greeting first name (the reported "bonjour" bug) ---')
const greets: [string, string][] = [
  ['Annie-Pier Legault', 'Annie-Pier'],
  ['Annie -Pier legault', 'Annie'],
  ['Coaching de couple-Ronald Bonheur', 'Ronald'],
  ['Anne Boutin', 'Anne'],
  ['Séance — Milane Cirnigliaro', 'Milane'],
  ['Coaching', ''],
  ['+15148917262', ''],
]
for (const [inp, want] of greets) eq(`greet: ${inp}`, greetingName(inp), want)
eq('greet: form clientName wins', greetingName('Séance — X Y', 'Trycia Pothier'), 'Trycia')

console.log('--- guest resolution (the couple bug) ---')
const opts = { serviceAccountEmail: 'sa@proj.iam.gserviceaccount.com', calendarId: 'chantal@gmail.com' }
eq('both partners returned', resolveGuestEmails([
  { email: 'chantal@gmail.com', self: true, organizer: true },
  { email: 'partner1@example.com' },
  { email: 'partner2@example.com' },
], opts), ['partner1@example.com', 'partner2@example.com'])
eq('service account excluded', resolveGuestEmails([
  { email: 'sa@proj.iam.gserviceaccount.com' }, { email: 'a@b.com' }], opts), ['a@b.com'])
eq('declined excluded', resolveGuestEmails([
  { email: 'a@b.com', responseStatus: 'declined' }, { email: 'c@d.com' }], opts), ['c@d.com'])
eq('dupes collapsed', resolveGuestEmails([
  { email: 'A@B.com' }, { email: 'a@b.com' }], opts), ['a@b.com'])
eq('resource excluded', resolveGuestEmails([{ email: 'room@x.com', resource: true }], opts), [])
eq('no attendees', resolveGuestEmails(null, opts), [])

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
