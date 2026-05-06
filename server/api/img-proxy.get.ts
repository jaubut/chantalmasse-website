export default defineEventHandler(async (event) => {
  const { url } = getQuery(event)
  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'url param required' })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid url' })
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isAllowedImageHost(parsed.hostname)) {
    throw createError({ statusCode: 403, message: 'Domain not allowed' })
  }

  const response = await $fetch.raw(parsed.toString(), {
    headers: {
      'Referer': 'https://www.instagram.com/',
      'User-Agent': 'Mozilla/5.0 (compatible)',
    },
  })

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw createError({ statusCode: 415, message: 'Only image responses can be proxied' })
  }

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return response._data
})

function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'static.wixstatic.com' ||
    host.endsWith('.wixstatic.com') ||
    host === 'instagram.com' ||
    host.endsWith('.instagram.com') ||
    host === 'cdninstagram.com' ||
    host.endsWith('.cdninstagram.com') ||
    host === 'fbcdn.net' ||
    host.endsWith('.fbcdn.net') ||
    host === 'facebook.com' ||
    host.endsWith('.facebook.com')
  )
}
