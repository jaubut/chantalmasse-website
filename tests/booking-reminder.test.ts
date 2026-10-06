import { bookingReminder } from '../trigger/booking-reminder'

declare global { var __EVENTS: any[]; var __PATCHES: any[]; var __LOGS: any[]; var __SENT: any[]; var __FAIL_TO: string[]; var __PATCH_FAIL: boolean }

process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'sa@proj.iam.gserviceaccount.com'
process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n'
process.env.GOOGLE_CALENDAR_ID = 'chantal@gmail.com'
process.env.RESEND_API_KEY = 're_fake'
process.env.EMAIL_FROM = 'hello@tech-lab.studio'

globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes('api.resend.com')) {
    const body = JSON.parse(init.body)
    if (globalThis.__FAIL_TO.includes(body.to)) return { ok: false, status: 422, text: async () => 'bad address' } as any
    globalThis.__SENT.push({ to: body.to, subject: body.subject, html: body.html })
    return { ok: true, status: 200, text: async () => '{}' } as any
  }
  throw new Error('unexpected fetch ' + url)
}) as any

const START = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
const END = new Date(Date.now() + 24 * 3600 * 1000 + 90 * 60000).toISOString()
const ev = (o: any) => ({
  id: o.id, summary: o.summary, colorId: o.colorId, status: o.status,
  start: { dateTime: o.start || START }, end: { dateTime: o.end || END },
  attendees: o.attendees, extendedProperties: o.priv ? { private: o.priv } : undefined,
})

let pass = 0, fail = 0
const check = (label: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`) }
  else { fail++; console.log(`  FAIL ${label} ${detail}`) }
}
const reset = (events: any[], failTo: string[] = []) => {
  globalThis.__EVENTS = events; globalThis.__PATCHES = []; globalThis.__LOGS = []
  globalThis.__SENT = []; globalThis.__FAIL_TO = failTo; globalThis.__PATCH_FAIL = false
}
const run = () => (bookingReminder as any).run({}, { ctx: {} })
const sentTo = () => globalThis.__SENT.map((s) => s.to).sort()
const privOf = (id: string) => globalThis.__EVENTS.find((e: any) => e.id === id).extendedProperties.private

;(async () => {
  console.log('1) couple booking with BOTH partners attached (the reported bug)')
  reset([ev({ id: 'c1', summary: 'Coaching de couple-Karine Bastien', colorId: '9',
    attendees: [{ email: 'chantal@gmail.com', self: true, organizer: true },
                { email: 'karine@example.com' }, { email: 'conjoint@example.com' }] })])
  let r = await run()
  check('both partners emailed', JSON.stringify(sentTo()) === JSON.stringify(['conjoint@example.com', 'karine@example.com']), JSON.stringify(sentTo()))
  check('event stamped complete', privOf('c1').reminderSent === '1')
  check('emailSent counter is 2', r.emailSent === 2, JSON.stringify(r))

  console.log('2) manual séance titled with a bare patient name, colour not 2/7')
  reset([ev({ id: 'm1', summary: 'Anne Boutin', colorId: '9',
    attendees: [{ email: 'chantal@gmail.com', self: true, organizer: true }, { email: 'anne@example.com' }] })])
  r = await run()
  check('reminder sent (old gate dropped this)', sentTo()[0] === 'anne@example.com')
  check('greeted by real first name', globalThis.__SENT[0].html.includes('On se voit demain, Anne.'))

  console.log('3) blocked time with a guest is never emailed')
  reset([ev({ id: 'b1', summary: 'Plage bloquée', colorId: '9', attendees: [{ email: 'someone@example.com' }] }),
         ev({ id: 'b2', summary: 'Pause diné', attendees: [{ email: 'someone@example.com' }] })])
  r = await run()
  check('no emails sent', globalThis.__SENT.length === 0)
  check('counted as notSession', r.notSession === 2, JSON.stringify(r))

  console.log('4) form booking still works and keeps its stored name')
  reset([ev({ id: 'f1', summary: 'Séance — Trycia Pothier', colorId: '2',
    priv: { clientEmail: 'tryciapothier@outlook.com', clientName: 'Trycia Pothier', cancelToken: 'tok123' } })])
  r = await run()
  check('form client emailed', sentTo()[0] === 'tryciapothier@outlook.com')
  check('greeted by stored name', globalThis.__SENT[0].html.includes('On se voit demain, Trycia.'))

  console.log('5) partial failure retries only the address that failed')
  reset([ev({ id: 'p1', summary: 'Coaching de couple-Ines lawson', colorId: '9',
    attendees: [{ email: 'a@example.com' }, { email: 'b@example.com' }] })], ['b@example.com'])
  r = await run()
  check('only the good address got mail', JSON.stringify(sentTo()) === JSON.stringify(['a@example.com']))
  check('event NOT marked complete', privOf('p1').reminderSent === undefined)
  check('good address recorded', privOf('p1').reminderSentTo === 'a@example.com')
  globalThis.__SENT = []; globalThis.__FAIL_TO = []
  r = await run()
  check('retry sends only to the failed address', JSON.stringify(sentTo()) === JSON.stringify(['b@example.com']), JSON.stringify(sentTo()))
  check('now marked complete', privOf('p1').reminderSent === '1')

  console.log('6) already-sent events are left alone')
  reset([ev({ id: 'd1', summary: 'Anne Boutin', colorId: '9', attendees: [{ email: 'anne@example.com' }],
    priv: { reminderSent: '1', reminderSentTo: 'anne@example.com' } })])
  r = await run()
  check('no duplicate email', globalThis.__SENT.length === 0)

  console.log('7) session with no resolvable guest is logged, not silently dropped')
  reset([ev({ id: 'n1', summary: 'Zoé Tringle', colorId: '9', attendees: [{ email: 'chantal@gmail.com', self: true, organizer: true }] })])
  r = await run()
  check('counted as skipped', r.skipped === 1, JSON.stringify(r))
  check('warning logged', globalThis.__LOGS.some((l) => l[0] === 'warn' && String(l[1]).includes('No recipient')))

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
})()
