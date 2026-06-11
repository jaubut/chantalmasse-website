// Pulls calendar events created in the last 21 days and groups them
// week1 (last 7d) vs prior14 (8-21d ago) for a quick demographic / mix check.
//
// Use: bun --env-file=.env scripts/investigate-recent-bookings.ts

import { google } from "googleapis"

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_CALENDAR_ID,
} = process.env

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
  console.error("Missing Google Calendar env vars")
  process.exit(1)
}

const auth = new google.auth.JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
})

const calendar = google.calendar({ version: "v3", auth })

const now = new Date()
const lookBackDays = 7
const lookForwardDays = 90
const compareWindowDays = 21

const timeMin = new Date(now.getTime() - lookBackDays * 86400_000).toISOString()
const timeMax = new Date(now.getTime() + lookForwardDays * 86400_000).toISOString()

const res = await calendar.events.list({
  calendarId: GOOGLE_CALENDAR_ID,
  timeMin,
  timeMax,
  singleEvents: true,
  orderBy: "startTime",
  maxResults: 2500,
})

const events = res.data.items ?? []

// Only events the booking flow created — they carry extendedProperties.private.cancelToken
type Booking = {
  created: string
  start: string
  title: string
  firstName: string
  service: string
  sessionType: string
  email: string
  phone: string
}

const bookings: Booking[] = []
for (const e of events) {
  const priv = e.extendedProperties?.private
  if (!priv?.cancelToken) continue // skip non-booking events
  const created = e.created ?? ""
  if (!created) continue
  const createdDate = new Date(created)
  const ageDays = (now.getTime() - createdDate.getTime()) / 86400_000
  if (ageDays > compareWindowDays || ageDays < 0) continue

  const title = e.summary ?? ""
  // "Séance — First Last"
  const m = title.match(/—\s*(\S+)/u)
  const firstName = m ? m[1]! : ""
  const desc = e.description ?? ""
  const serviceMatch = desc.match(/Service:\s*(.+)/i)
  const service = serviceMatch ? serviceMatch[1]!.trim() : "?"

  bookings.push({
    created,
    start: e.start?.dateTime ?? e.start?.date ?? "",
    title,
    firstName,
    service,
    sessionType: priv.sessionType ?? "",
    email: priv.clientEmail ?? "",
    phone: priv.clientPhone ?? "",
  })
}

// Heuristic: classify first-name gender from a small QC-French list.
// Not authoritative — just a screening lens. Unknown names → "?".
const MALE_NAMES = new Set(
  [
    "alexandre","alex","antoine","arthur","benoit","bruno","carl","charles","christian","christophe","claude","daniel","danny","david","denis","dominic","dominique","eric","éric","etienne","étienne","francois","françois","francis","frederic","frédéric","gabriel","gaston","gilles","guillaume","guy","hugo","jacques","jean","jean-francois","jean-françois","jean-philippe","jeremie","jeremy","jérémy","jérémie","jerome","jérôme","joel","joël","jonathan","jordan","julien","kevin","kévin","laurent","luc","lucas","ludovic","marc","marc-andre","marc-andré","mario","mathieu","matthieu","mathys","maxime","michael","michaël","michel","mickael","mickaël","nicolas","olivier","pascal","patrick","paul","philippe","pierre","raphael","raphaël","remi","rémi","renaud","richard","robert","rodrigue","roger","roland","sebastien","sébastien","serge","simon","stephane","stéphane","steve","sylvain","thierry","thomas","tristan","vincent","william","xavier","yannick","yvan","yves",
  ],
)

const FEMALE_NAMES = new Set(
  [
    "alice","alicia","alexandra","alexandrine","amelie","amélie","andrea","andréa","andree","andrée","anne","annie","ariane","audrey","beatrice","béatrice","caroline","catherine","cecile","cécile","celine","céline","chantal","chloe","chloé","christine","claire","claudia","claudine","cynthia","danielle","diane","dominique","elena","elise","élise","elisabeth","élisabeth","emilie","émilie","emma","esther","eve","ève","florence","france","francine","francoise","françoise","gabrielle","genevieve","geneviève","ginette","helene","hélène","ingrid","isabelle","jacqueline","jade","jeannine","jennifer","jessica","johanne","josee","josée","josiane","julie","juliette","karine","kathleen","katia","katrine","laetitia","laurence","laurie","lea","léa","liliane","line","lise","louise","lucie","ludivine","lyne","madeleine","manon","marie","marie-claude","marie-eve","marie-ève","marie-france","marie-josee","marie-josée","marielle","marlene","marlène","martine","mathilde","melanie","mélanie","mireille","monique","murielle","myriam","nadia","nadine","nancy","natalia","nathalie","nicole","nicolette","noemie","noémie","odette","pascale","patricia","pauline","pierrette","rachel","raphaelle","raphaëlle","renee","renée","roxane","sabrina","sandra","sandrine","sara","sarah","silvia","sonia","sophie","stephanie","stéphanie","suzanne","sylvie","tania","valerie","valérie","vanessa","veronique","véronique","violette","virginie","viviane","yolande","zoe","zoé",
  ],
)

function classify(name: string): "M" | "F" | "?" {
  const norm = name.trim().toLowerCase()
  if (!norm) return "?"
  // Try first token (handles compound names)
  const first = norm.split(/[-\s]/)[0]!
  if (MALE_NAMES.has(norm) || MALE_NAMES.has(first)) return "M"
  if (FEMALE_NAMES.has(norm) || FEMALE_NAMES.has(first)) return "F"
  return "?"
}

bookings.sort((a, b) => a.created.localeCompare(b.created))

const week1: Booking[] = []
const prior14: Booking[] = []
for (const b of bookings) {
  const age = (now.getTime() - new Date(b.created).getTime()) / 86400_000
  if (age <= 7) week1.push(b)
  else prior14.push(b)
}

function summary(label: string, list: Booking[]) {
  let m = 0,
    f = 0,
    u = 0
  let couple = 0,
    individual = 0
  const examples: string[] = []
  for (const b of list) {
    const g = classify(b.firstName)
    if (g === "M") m++
    else if (g === "F") f++
    else u++
    if (/couple/i.test(b.service)) couple++
    else individual++
    examples.push(
      `${b.created.slice(0, 10)}  ${g}  ${b.firstName.padEnd(15)} ${b.sessionType.padEnd(10)} ${b.service}`,
    )
  }
  const total = list.length
  console.log(`\n── ${label}  (n=${total}) ──`)
  if (total === 0) {
    console.log("  no bookings")
    return
  }
  const pct = (n: number) => (total ? ((n / total) * 100).toFixed(0) + "%" : "—")
  console.log(`  M:${m} (${pct(m)})  F:${f} (${pct(f)})  ?:${u} (${pct(u)})`)
  console.log(`  individual:${individual}  couple:${couple}`)
  console.log("  ──────")
  for (const line of examples) console.log("  " + line)
}

summary("LAST 7 DAYS", week1)
summary("PRIOR 14 DAYS (8-21d ago)", prior14)

// Print emails too so we can sanity-check name<->email gender match
console.log("\n── emails (last 7d) ──")
for (const b of week1) {
  console.log(`  ${b.firstName.padEnd(15)} ${classify(b.firstName)}  ${b.email}`)
}
