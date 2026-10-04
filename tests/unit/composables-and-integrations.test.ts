import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { detectPillar, mediaTypeToLabel } from '~/utils/metaApi'

// useState double: one shared ref per key, like Nuxt's per-request state.
const state = new Map<string, Ref<unknown>>()
vi.stubGlobal('useState', <T>(key: string, init: () => T) => {
  if (!state.has(key)) state.set(key, ref(init()))
  return state.get(key) as Ref<T>
})

describe('useBooking / useContact', () => {
  beforeEach(() => state.clear())

  it('opens the booking modal with an optional preselected service', async () => {
    const { useBooking } = await import('~/composables/useBooking')
    const a = useBooking()
    const b = useBooking()
    a.open('couple')
    expect(b.isOpen.value).toBe(true)
    expect(b.preselectedServiceId.value).toBe('couple')
    b.close()
    expect(a.isOpen.value).toBe(false)
    expect(a.preselectedServiceId.value).toBeNull()
    a.open()
    expect(a.preselectedServiceId.value).toBeNull()
  })

  it('toggles the contact modal through shared state', async () => {
    const { useContact } = await import('~/composables/useContact')
    useContact().open()
    expect(useContact().isOpen.value).toBe(true)
    useContact().close()
    expect(useContact().isOpen.value).toBe(false)
  })
})

describe('Meta Conversions API', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is a silent no-op when not configured (CI / dev)', async () => {
    const { sendMetaCapiEvent } = await import('~/server/utils/metaCapi')
    const res = await sendMetaCapiEvent({ eventName: 'Schedule', eventId: 'e', eventSourceUrl: 'https://x', user: {} })
    expect(res.ok).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('hashes PII and never throws on network failure', async () => {
    vi.stubEnv('META_PIXEL_ID', '123')
    vi.stubEnv('META_CAPI_ACCESS_TOKEN', 'dummy')
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ events_received: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchFn)
    const { sendMetaCapiEvent } = await import('~/server/utils/metaCapi')
    const res = await sendMetaCapiEvent({
      eventName: 'Schedule', eventId: 'evt', eventSourceUrl: 'https://chantalmasse.com/prendre-rendez-vous',
      value: 105, user: { email: ' Marie@Example.com ', phone: '+1 450 555 1234', ipAddress: '1.2.3.4' },
    })
    expect(res).toMatchObject({ ok: true, events_received: 1 })
    const sent = JSON.parse(fetchFn.mock.calls[0]![1].body)
    const user = sent.data[0].user_data
    expect(user.em).toBe(createHash('sha256').update('marie@example.com').digest('hex'))
    expect(user.ph).toBe(createHash('sha256').update('14505551234').digest('hex'))
    expect(JSON.stringify(sent)).not.toContain('marie@example.com')
    expect(user.client_ip_address).toBe('1.2.3.4')

    fetchFn.mockRejectedValue(new Error('offline'))
    await expect(sendMetaCapiEvent({ eventName: 'Lead', eventId: 'e', eventSourceUrl: 'u', user: {} })).resolves.toMatchObject({ ok: false, error: 'offline' })
  })
})

describe('weekly brief (Anthropic)', () => {
  const create = vi.fn()
  vi.doMock('@anthropic-ai/sdk', () => ({ default: class { messages = { create } } }))
  afterEach(() => vi.unstubAllEnvs())

  it('refuses to run without an API key', async () => {
    const { generateBrief } = await import('~/server/utils/briefService')
    await expect(generateBrief({})).rejects.toThrow(/ANTHROPIC_API_KEY/)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns the first text block of the reply', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'dummy')
    create.mockResolvedValue({ content: [{ type: 'text', text: 'Brief de la semaine' }] })
    const { generateBrief } = await import('~/server/utils/briefService')
    await expect(generateBrief({ posts: [] }, 'prompt perso')).resolves.toBe('Brief de la semaine')
    expect(create.mock.calls[0]![0]).toMatchObject({ system: 'prompt perso', max_tokens: 1500 })
  })
})

describe('metaApi helpers', () => {
  it.each([
    ['Mythe ou réalité?', 'myth'],
    ['Un petit défi cette semaine', 'challenge'],
    ['Question pour vous', 'qa'],
    ['Une réflexion du dimanche', 'reflection'],
    ['Bonjour', 'general'],
  ])('detectPillar(%s) = %s', (caption, pillar) => {
    expect(detectPillar(caption)).toBe(pillar)
  })

  it('labels media types in French', () => {
    expect(mediaTypeToLabel('VIDEO')).toBe('Reel')
    expect(mediaTypeToLabel('carousel_album')).toBe('Carrousel')
    expect(mediaTypeToLabel('')).toBe('Publication')
  })
})
