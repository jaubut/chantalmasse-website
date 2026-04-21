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
  clientPhone?: string
  smsConsent?: boolean
  cancelToken: string
}) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  // No `attendees` array: the service account cannot invite attendees
  // without Google Workspace Domain-Wide Delegation, which Chantal's personal
  // calendar setup doesn't have — Google rejects the insert with 403
  // forbiddenForServiceAccounts. The client still gets the Resend confirmation
  // email (with the Meet link) and the event is visible on Chantal's calendar.
  const event: Parameters<typeof calendar.events.insert>[0]['requestBody'] = {
    summary: params.title,
    description: params.description,
    start: { dateTime: params.startISO, timeZone: 'America/Toronto' },
    end: { dateTime: params.endISO, timeZone: 'America/Toronto' },
    colorId: params.colorId,
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
        ...(params.clientPhone ? { clientPhone: params.clientPhone } : {}),
        ...(params.smsConsent ? { smsConsent: '1', smsReminderSent: '0' } : {}),
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

// Lookup a future event by its cancel token — embedded in
// extendedProperties.private.cancelToken at creation. Returns null when
// the token is unknown or the event has already passed (timeMin=now).
// Scans the next 120 days which safely exceeds BOOKING_ADVANCE_DAYS=60.
export async function findEventByCancelToken(token: string) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  const now = new Date()
  const timeMax = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000)

  const res = await calendar.events.list({
    calendarId: config.googleCalendarId as string,
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    privateExtendedProperty: [`cancelToken=${token}`],
    maxResults: 1,
  })

  return res.data.items?.[0] ?? null
}

export async function cancelEventById(eventId: string) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  await calendar.events.delete({
    calendarId: config.googleCalendarId as string,
    eventId,
  })
}

export async function markSmsReminderSent(eventId: string) {
  const calendar = getCalendarClient()
  const config = useRuntimeConfig()

  await calendar.events.patch({
    calendarId: config.googleCalendarId as string,
    eventId,
    requestBody: {
      extendedProperties: {
        private: {
          smsReminderSent: '1',
        },
      },
    },
  })
}
