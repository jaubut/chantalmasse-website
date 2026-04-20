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
  sessionType: 'in-person' | 'video'
  colorId: string
  clientEmail: string
  clientName: string
  cancelToken: string
}) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  const event: Parameters<typeof calendar.events.insert>[0]['requestBody'] = {
    summary: params.title,
    description: params.description,
    start: { dateTime: params.startISO, timeZone: 'America/Toronto' },
    end: { dateTime: params.endISO, timeZone: 'America/Toronto' },
    colorId: params.colorId,
    attendees: [
      { email: params.clientEmail, displayName: params.clientName, responseStatus: 'accepted' },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
      ],
    },
    extendedProperties: {
      private: {
        clientEmail: params.clientEmail,
        clientName: params.clientName,
        cancelToken: params.cancelToken,
        sessionType: params.sessionType,
        reminderSent: '0',
      },
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

export async function listPendingReminderEvents(params: {
  timeMinISO: string
  timeMaxISO: string
}) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  const res = await calendar.events.list({
    calendarId: config.googleCalendarId as string,
    timeMin: params.timeMinISO,
    timeMax: params.timeMaxISO,
    singleEvents: true,
    orderBy: 'startTime',
    privateExtendedProperty: ['reminderSent=0'],
  })

  return res.data.items || []
}

export async function markReminderSent(eventId: string) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  await calendar.events.patch({
    calendarId: config.googleCalendarId as string,
    eventId,
    requestBody: {
      extendedProperties: {
        private: {
          reminderSent: '1',
        },
      },
    },
  })
}
