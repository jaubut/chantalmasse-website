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
    const conversions = await page.evaluate(() => {
      const layer = (window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []
      return Array.from(layer, (entry) => Array.from(entry))
        .filter((entry) => ['booking_confirmed', 'generate_lead', 'conversion'].includes(String(entry[1])))
    })
    expect(conversions).toEqual([
      ['event', 'generate_lead', { event_category: 'contact', event_label: 'contact_form' }],
    ])
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

test.describe('newsletter confirmation page', () => {
  for (const result of ['confirmed', 'opted_out', 'invalid']) {
    test(`keeps the token through hydration, confirms only on click: ${result}`, async ({ page }) => {
      const bodies: unknown[] = []
      await page.route('**/api/newsletter/confirm', async (route) => {
        bodies.push(route.request().postDataJSON())
        await route.fulfill({ json: { result } })
      })
      await page.goto('/confirmer-inscription#t=abc.def')
      await waitForHydration(page)
      const confirm = page.getByRole('button', { name: 'Confirmer mon inscription' })
      await expect(confirm).toBeEnabled()
      await expect(page).toHaveURL(/\/confirmer-inscription$/)
      await expect(page.locator('script[src*="googletagmanager.com"], script[src*="connect.facebook.net"]')).toHaveCount(0)
      expect(await page.evaluate(() => {
        const analytics = window as unknown as { dataLayer: unknown[]; fbq: { queue: unknown[] } }
        return [analytics.dataLayer.length, analytics.fbq.queue.length]
      })).toEqual([0, 0])
      expect(bodies).toEqual([])

      await confirm.click()
      if (result === 'confirmed') await expect(page).toHaveURL(/\/inscription-confirmee$/)
      else await expect(page.getByText(result === 'opted_out' ? /Vous vous étiez désabonné·e/ : /invalide ou expiré/)).toBeVisible()
      expect(bodies).toEqual([{ token: 'abc.def' }])
    })
  }

  test('retains the token for a retry after a network failure on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const bodies: unknown[] = []
    await page.route('**/api/newsletter/confirm', async (route) => {
      bodies.push(route.request().postDataJSON())
      if (bodies.length === 1) await route.fulfill({ status: 503, json: { message: 'indisponible' } })
      else await route.fulfill({ json: { result: 'confirmed' } })
    })
    await page.goto('/confirmer-inscription#t=abc.def')
    const confirm = page.getByRole('button', { name: 'Confirmer mon inscription' })
    await expect(confirm).toBeEnabled()
    await expect(page).toHaveURL(/\/confirmer-inscription$/)
    expect(bodies).toEqual([])
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('Une erreur est survenue. Réessayez.')
    await confirm.click()
    await expect(page).toHaveURL(/\/inscription-confirmee$/)
    expect(bodies).toEqual([{ token: 'abc.def' }, { token: 'abc.def' }])
  })

  test('a link without a token shows the invalid state', async ({ page }) => {
    await page.goto('/confirmer-inscription')
    await waitForHydration(page)
    await expect(page.getByText(/invalide ou expiré/)).toBeVisible()
  })
})
