import { beforeEach, describe, expect, it } from 'vitest'
import { callHandler, fetchMock, loadHandler } from '../helpers/server'

const load = () => loadHandler('~/server/api/img-proxy.get')

describe('GET /api/img-proxy', () => {
  beforeEach(() => {
    fetchMock().raw.mockResolvedValue({
      headers: new Headers({ 'content-type': 'image/png' }),
      _data: new Uint8Array([137, 80, 78, 71]),
    })
  })

  it('requires a url', async () => {
    expect((await callHandler(await load())).status).toBe(400)
  })

  it('rejects an unparseable url', async () => {
    expect((await callHandler(await load(), { query: { url: 'not a url' } })).status).toBe(400)
  })

  it.each([
    'https://evil.example.com/a.png',
    'https://static.wixstatic.com.evil.io/a.png',
    'https://notinstagram.com/a.png',
    'file:///etc/passwd',
    'ftp://static.wixstatic.com/a.png',
    'http://169.254.169.254/latest/meta-data',
  ])('refuses to proxy %s (SSRF guard)', async (url) => {
    const res = await callHandler(await load(), { query: { url } })
    expect(res.status).toBe(403)
    expect(fetchMock().raw).not.toHaveBeenCalled()
  })

  it('refuses non-image responses', async () => {
    fetchMock().raw.mockResolvedValue({ headers: new Headers({ 'content-type': 'text/html' }), _data: '<html>' })
    const res = await callHandler(await load(), { query: { url: 'https://scontent.cdninstagram.com/x.jpg' } })
    expect(res.status).toBe(415)
  })

  it.each([
    'https://static.wixstatic.com/media/a.jpg',
    'https://scontent-yyz1-1.cdninstagram.com/v/x.jpg',
    'https://scontent.xx.fbcdn.net/x.jpg',
  ])('proxies allowed image hosts with a 1-day cache (%s)', async (url) => {
    const res = await callHandler(await load(), { query: { url } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    expect(fetchMock().raw.mock.calls[0]![0]).toBe(new URL(url).toString())
  })
})
