import type { Page, Route } from '@playwright/test'
import { expect, test, waitForHydration } from './fixtures'

// Booking flow up to (and including) submit, with the booking API mocked at
// the network layer: nothing reaches Google Calendar, Resend or Twilio.

function nextBookableDate(): Date {
  // A Tuesday at least 3 days out, in the current or next month.
  const d = new Date()
  d.setDate(d.getDate() + 3)
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1)
  return d
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ym = (d: Date) => ymd(d).slice(0, 7)

async function conversionEvents(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    const layer = (window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []
    return Array.from(layer, (entry) => Array.from(entry))
      .filter((entry) => ['booking_confirmed', 'generate_lead', 'conversion'].includes(String(entry[1])))
  })
}

async function mockAvailability(page: Page, date: Date) {
  const key = ymd(date)
  const slot = {
    isoStart: `${key}T13:00:00.000Z`,
    isoEnd: `${key}T14:00:00.000Z`,
    label: '09h00 — 10h00',
  }
  await page.route('**/api/booking/availability**', (route: Route) => {
    const url = new URL(route.request().url())
    const month = url.searchParams.get('month')
    const isTarget = month === ym(date)
    return route.fulfill({
      json: {
        month,
        service: url.searchParams.get('service'),
        availableDates: isTarget ? [key] : [],
        slotsByDate: isTarget ? { [key]: [slot] } : {},
      },
    })
  })
  return slot
}

async function openModalAtCalendar(page: Page, date: Date) {
  await page.goto('/')
  await waitForHydration(page)
  await page.getByRole('button', { name: 'Prendre rendez-vous' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Quel accompagnement souhaites-tu?' })).toBeVisible()
  await dialog.getByRole('button', { name: /Thérapie Individuelle/ }).click()
  // Move to the target month if it's next month.
  if (date.getMonth() !== new Date().getMonth()) {
    await dialog.getByRole('button', { name: 'Mois suivant' }).click()
  }
  return dialog
}

for (const width of [1440, 390]) {
  test(`booking: service → date → time → form validation → mocked submit → confirmation (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    const date = nextBookableDate()
    const slot = await mockAvailability(page, date)
    let submitted: Record<string, unknown> | null = null
    await page.route('**/api/booking/create', async (route) => {
      submitted = route.request().postDataJSON()
      await route.fulfill({
        json: {
          success: true, eventId: 'smoke-evt', meetLink: null, cancelToken: 'smoke-token',
          dateFormatted: 'mardi', timeFormatted: '09h00 — 10h00',
        },
      })
    })

    const dialog = await openModalAtCalendar(page, date)
    expect(await conversionEvents(page)).toEqual([])
    const day = dialog.getByRole('button', { name: new RegExp(`^${date.getDate()} `) })
    await expect(day).toBeEnabled()
    await day.click()

    await dialog.getByRole('button', { name: /09h00 — 10h00/ }).click()
    const submit = dialog.getByRole('button', { name: /Confirmer ma réservation/ })
    await expect(submit).toBeVisible()

    // Client-side validation: empty form never reaches the API, and the French
    // messages show instead of the browser's (locale-dependent) native bubbles.
    await submit.click()
    await expect(dialog.getByText('Le prénom est requis')).toBeVisible()
    await expect(dialog.getByText('Le courriel est requis')).toBeVisible()
    await expect(dialog.locator('input[autocomplete="given-name"]')).toBeFocused()
    await expect(dialog.locator('input[autocomplete="given-name"]')).toBeInViewport()
    await dialog.locator('input[autocomplete="given-name"]').fill('Marie')
    await dialog.locator('input[autocomplete="family-name"]').fill('Tremblay')
    await dialog.locator('input[type="email"]').fill('pas-un-courriel@x')
    await dialog.getByRole('checkbox').nth(1).check() // privacy
    await dialog.getByRole('checkbox').first().check() // SMS consent without phone
    await dialog.locator('form').evaluate((f: HTMLFormElement) => f.requestSubmit())
    await expect(dialog.getByText('Adresse courriel invalide')).toBeVisible()
    await expect(dialog.getByText('Un numéro est requis pour les rappels SMS')).toBeVisible()
    expect(submitted).toBeNull()
    expect(await conversionEvents(page)).toEqual([])

    await dialog.locator('input[type="email"]').fill('marie@example.com')
    await dialog.locator('input[type="tel"]').fill('450 555-1234')
    const layout = await dialog.evaluate((element) => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      bounds: { top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom },
      inputFontSizes: Array.from(element.querySelectorAll('input:not([type="checkbox"])'), (input) => getComputedStyle(input).fontSize),
      controls: Array.from(element.querySelectorAll('button'), (button) => ({
        label: button.getAttribute('aria-label') || button.textContent?.trim(),
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
      })),
    }))
    await testInfo.attach('booking-layout', { body: JSON.stringify(layout, null, 2), contentType: 'application/json' })
    expect(layout.overflow).toBe(false)
    for (const control of layout.controls.filter(c => c.label === 'Retour' || c.label === 'Fermer')) {
      expect(control.height).toBeGreaterThanOrEqual(44)
    }
    await submit.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', 'Réservation confirmée')
    expect(submitted).toMatchObject({
      serviceId: 'individual',
      isoStart: slot.isoStart,
      isoEnd: slot.isoEnd,
      sessionType: 'in-person',
      client: { firstName: 'Marie', lastName: 'Tremblay', email: 'marie@example.com', phone: '450 555-1234', smsConsent: true },
    })
    expect(await conversionEvents(page)).toEqual([
      ['event', 'booking_confirmed', { currency: 'CAD', value: 105, event_category: 'booking', event_label: 'Thérapie Individuelle' }],
      ['event', 'conversion', { send_to: 'AW-16485477025/IFK1CJuhqrodEKHV8bQ9', transaction_id: 'smoke-evt', currency: 'CAD', value: 105 }],
    ])
  })
}

test('booking: a server-side refusal (409) is shown to the client', async ({ page }) => {
  const date = nextBookableDate()
  await mockAvailability(page, date)
  await page.route('**/api/booking/create', (route) => route.fulfill({
    status: 409,
    json: { statusCode: 409, message: "Ce créneau n'est plus disponible. Veuillez en choisir un autre." },
  }))
  const dialog = await openModalAtCalendar(page, date)
  await dialog.getByRole('button', { name: new RegExp(`^${date.getDate()} `) }).click()
  await dialog.getByRole('button', { name: /09h00 — 10h00/ }).click()
  await dialog.locator('input[autocomplete="given-name"]').fill('Marie')
  await dialog.locator('input[autocomplete="family-name"]').fill('Tremblay')
  await dialog.locator('input[type="email"]').fill('marie@example.com')
  await dialog.getByRole('checkbox').nth(1).check()
  await dialog.getByRole('button', { name: /Confirmer ma réservation/ }).click()
  await expect(dialog.getByText("Ce créneau n'est plus disponible")).toBeVisible()
  expect(await conversionEvents(page)).toEqual([])
})

for (const response of [
  { name: 'unsuccessful response', body: { success: false, eventId: 'not-created' } },
  { name: 'missing booking ID', body: { success: true } },
  { name: 'empty booking ID', body: { success: true, eventId: '' } },
]) {
  test(`booking: a 2xx ${response.name} cannot confirm or convert`, async ({ page }) => {
    const date = nextBookableDate()
    await mockAvailability(page, date)
    await page.route('**/api/booking/create', (route) => route.fulfill({ json: response.body }))
    const dialog = await openModalAtCalendar(page, date)
    await dialog.getByRole('button', { name: new RegExp(`^${date.getDate()} `) }).click()
    await dialog.getByRole('button', { name: /09h00 — 10h00/ }).click()
    await dialog.locator('input[autocomplete="given-name"]').fill('Marie')
    await dialog.locator('input[autocomplete="family-name"]').fill('Tremblay')
    await dialog.locator('input[type="email"]').fill('marie@example.com')
    await dialog.getByRole('checkbox').nth(1).check()
    await dialog.getByRole('button', { name: /Confirmer ma réservation/ }).click()
    await expect(dialog.getByText('Une erreur est survenue. Réessaie dans un instant.')).toBeVisible()
    await expect(dialog).not.toHaveAttribute('aria-label', 'Réservation confirmée')
    expect(await conversionEvents(page)).toEqual([])
  })
}

// Google Ads deep link: the prerendered page must read the query client-side,
// open the modal and skip straight to the calendar for the requested service.
for (const service of ['individual', 'couple'] as const) {
  test(`booking: /prendre-rendez-vous?book=open preselects ${service} (Ads deep link)`, async ({ page }) => {
    const date = nextBookableDate()
    await mockAvailability(page, date)
    const availability = page.waitForRequest((req) =>
      req.url().includes('/api/booking/availability') && new URL(req.url()).searchParams.get('service') === service)
    await page.goto(`/prendre-rendez-vous?book=open&service=${service}`)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveAttribute('aria-label', 'Choisir une date')
    await expect(dialog.getByText("Les disponibilités sont affichées en heure de l'Est (ET)")).toBeVisible()
    await availability
    expect(await conversionEvents(page)).toEqual([])
  })
}

test('booking: a failed availability load says so and retries', async ({ page, guard }) => {
  guard.allowConsole.push(/503/)
  const date = nextBookableDate()
  let down = true
  await page.route('**/api/booking/availability**', (route) => {
    if (down) return route.fulfill({ status: 503, body: 'error code: 1102' })
    const url = new URL(route.request().url())
    const isTarget = url.searchParams.get('month') === ym(date)
    return route.fulfill({ json: { availableDates: isTarget ? [ymd(date)] : [], slotsByDate: {} } })
  })
  await page.goto('/prendre-rendez-vous?book=open&service=individual')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('Impossible de charger les disponibilités')
  down = false
  await dialog.getByRole('button', { name: 'Réessayer' }).click()
  if (date.getMonth() !== new Date().getMonth()) await dialog.getByRole('button', { name: 'Mois suivant' }).click()
  await expect(dialog.getByRole('button', { name: new RegExp(`^${date.getDate()} `) })).toBeEnabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})

test('booking: couple slots never advertise video (in-person only)', async ({ page }) => {
  const date = nextBookableDate()
  await mockAvailability(page, date)
  await page.goto('/prendre-rendez-vous?book=open&service=couple')
  const dialog = page.getByRole('dialog')
  if (date.getMonth() !== new Date().getMonth()) await dialog.getByRole('button', { name: 'Mois suivant' }).click()
  await dialog.getByRole('button', { name: new RegExp(`^${date.getDate()} `) }).click()
  await expect(dialog.getByRole('button', { name: /09h00 — 10h00/ })).toBeVisible()
  await expect(dialog.getByText('Visio disponible')).toHaveCount(0)
})

test('booking: the real API refuses invalid requests (no secrets configured)', async ({ request }) => {
  const bad = await request.get('/api/booking/availability?month=nope&service=individual')
  expect(bad.status()).toBe(400)
  const create = await request.post('/api/booking/create', { data: { serviceId: 'nope' } })
  expect(create.status()).toBe(400)
  const cancel = await request.post('/api/booking/cancel', { data: {} })
  expect(cancel.status()).toBe(400)
})
