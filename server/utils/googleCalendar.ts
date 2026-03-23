import { google } from 'googleapis'

export function getCalendarClient() {
  const config = useRuntimeConfig()

  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail as string,
    key: (config.googlePrivateKey as string).replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })

  return google.calendar({ version: 'v3', auth })
}

export async function getEventsForMonth(year: number, month: number) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  const timeMin = new Date(year, month - 1, 1).toISOString()
  const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString()

  const res = await calendar.events.list({
    calendarId: config.googleCalendarId as string,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  })

  return res.data.items || []
}

export async function createBookingEvent(params: {
  title: string
  description: string
  startISO: string
  endISO: string
  clientEmail: string
  sessionType: 'in-person' | 'video'
  colorId: string
}) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  const event: Parameters<typeof calendar.events.insert>[0]['requestBody'] = {
    summary: params.title,
    description: params.description,
    start: { dateTime: params.startISO, timeZone: 'America/Toronto' },
    end: { dateTime: params.endISO, timeZone: 'America/Toronto' },
    colorId: params.colorId,
    attendees: [{ email: params.clientEmail }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    },
  }

  if (params.sessionType === 'video') {
    ;(event as any).conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const res = await calendar.events.insert({
    calendarId: config.googleCalendarId as string,
    requestBody: event,
    conferenceDataVersion: params.sessionType === 'video' ? 1 : 0,
    sendUpdates: 'all',
  })

  return res.data
}
