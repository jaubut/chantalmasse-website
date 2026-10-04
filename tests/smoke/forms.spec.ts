import { expect, test, waitForHydration } from './fixtures'

test.describe('contact form', () => {
  test('validates required fields before sending, then submits (mocked)', async ({ page }) => {
    let calls = 0
    let body: Record<string, unknown> | null = null
    await page.route('**/api/contact', async (route) => {
      calls++
      body = route.request().postDataJSON()
      await route.fulfill({ json: { ok: true } })
    })

    await page.goto('/')
    await waitForHydration(page)
    await page.locator('nav').getByRole('button', { name: 'Me contacter' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Me contacter' })
    await expect(dialog).toBeVisible()

    const send = dialog.getByRole('button', { name: 'Envoyer' })
    await send.click()
    // Native required validation blocks the submit.
    expect(await dialog.locator('#contact-name').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true)
    expect(calls).toBe(0)

    await dialog.getByLabel('Nom').fill('Marie Tremblay')
    await dialog.getByLabel('Courriel ou téléphone').fill('marie@example.com')
    await send.click()
    expect(await dialog.locator('#contact-message').evaluate((el: HTMLTextAreaElement) => el.validity.valueMissing)).toBe(true)
    expect(calls).toBe(0)

    await dialog.getByLabel('Message').fill("J'aimerais un premier rendez-vous.")
    await send.click()
    await expect(dialog.getByText('Message envoyé! Je te reviens bientôt.')).toBeVisible()
    expect(calls).toBe(1)
    expect(body).toEqual({ name: 'Marie Tremblay', contact: 'marie@example.com', message: "J'aimerais un premier rendez-vous.", website: '' })
  })

  test('shows the fallback email when sending fails', async ({ page }) => {
    await page.route('**/api/contact', (route) => route.fulfill({ status: 503, json: { message: 'indisponible' } }))
    await page.goto('/mentions-legales')
    await waitForHydration(page)
    await page.locator('footer').getByRole('button').first().click()
    const dialog = page.getByRole('dialog', { name: 'Me contacter' })
    await dialog.getByLabel('Nom').fill('Marie')
    await dialog.getByLabel('Courriel ou téléphone').fill('450-555-1234')
    await dialog.getByLabel('Message').fill('Bonjour')
    await dialog.getByRole('button', { name: 'Envoyer' }).click()
    await expect(dialog.getByText(/chantal\.gmasse@gmail\.com/)).toBeVisible()
  })

  test('the real endpoint rejects an empty message (400)', async ({ request }) => {
    const res = await request.post('/api/contact', { data: { name: 'x', contact: 'y' } })
    expect(res.status()).toBe(400)
  })
})

test.describe('newsletter', () => {
  test('the real endpoint rejects an invalid email (400)', async ({ request }) => {
    const res = await request.post('/api/newsletter/subscribe', { data: { email: 'nope' } })
    expect(res.status()).toBe(400)
  })
})

test.describe('cancellation page', () => {
  test('confirms then cancels a booking (mocked API)', async ({ page }) => {
    await page.route('**/api/booking/cancel-info**', (route) => route.fulfill({
      json: { firstName: 'Marie', service: 'Thérapie Individuelle', sessionType: 'video', date: 'mardi 13 octobre 2026', time: '09h00 — 10h00', startISO: '2026-10-13T13:00:00Z' },
    }))
    let cancelled: unknown = null
    await page.route('**/api/booking/cancel', async (route) => {
      cancelled = route.request().postDataJSON()
      await route.fulfill({ json: { success: true } })
    })
    await page.goto('/annuler?token=smoke-token')
    await expect(page.getByRole('heading', { level: 1, name: 'Annuler votre séance' })).toBeVisible()
    await expect(page.getByText('Visioconférence')).toBeVisible()
    await page.getByRole('button', { name: 'Oui, annuler' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Rendez-vous annulé' })).toBeVisible()
    expect(cancelled).toEqual({ token: 'smoke-token' })
  })

  test('an expired link shows the API message', async ({ page }) => {
    await page.route('**/api/booking/cancel-info**', (route) => route.fulfill({
      status: 404, json: { statusCode: 404, message: "Ce lien n'est plus valide. Le rendez-vous a peut-être déjà été annulé ou est passé." },
    }))
    await page.goto('/annuler?token=old')
    await expect(page.getByRole('heading', { level: 1, name: 'Lien invalide' })).toBeVisible()
    await expect(page.getByText(/déjà été annulé ou est passé/)).toBeVisible()
  })
})
