// Mutable stand-in for Nuxt's useRuntimeConfig(). Values are placeholders,
// never real credentials.
export interface TestRuntimeConfig {
  [key: string]: unknown
  public: Record<string, unknown>
}

const defaults = (): TestRuntimeConfig => ({
  googleServiceAccountEmail: 'ci@example.iam.gserviceaccount.com',
  googlePrivateKey: 'dummy',
  googleCalendarId: 'calendar@example.com',
  resendApiKey: 're_test_dummy',
  emailFrom: 'reservations@example.com',
  emailTo: 'chantal@example.com',
  chantalMeetLink: 'https://meet.google.com/abc-defg-hij',
  bookingMinNoticeHours: '24',
  siteBaseUrl: 'https://chantalmasse.com',
  brevoApiKey: 'xkeysib-dummy',
  brevoListId: '7',
  brevoDoiTemplateId: '12',
  public: {
    bookingTimezone: 'America/Toronto',
    bookingAdvanceDays: '60',
    posthogKey: '',
    posthogHost: 'https://us.i.posthog.com',
  },
})

export const runtimeConfig: TestRuntimeConfig = defaults()

/** Reset to defaults, then apply overrides (top-level keys). */
export function setRuntimeConfig(overrides: Partial<TestRuntimeConfig> = {}): void {
  for (const key of Object.keys(runtimeConfig)) delete runtimeConfig[key]
  Object.assign(runtimeConfig, defaults(), overrides)
}
