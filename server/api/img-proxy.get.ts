export default defineEventHandler(async (event) => {
  const { url } = getQuery(event)
  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'url param required' })
  }

  // Only proxy known CDN domains
  const allowed = [
    'scontent-',
    'cdninstagram.com',
    'fbcdn.net',
    'fna.fbcdn.net',
    'external.',
    'facebook.com',
    'instagram.com',
    'wixstatic.com',
  ]
  if (!allowed.some(d => url.includes(d))) {
    throw createError({ statusCode: 403, message: 'Domain not allowed' })
  }

  const response = await $fetch.raw(url, {
    headers: {
      'Referer': 'https://www.instagram.com/',
      'User-Agent': 'Mozilla/5.0 (compatible)',
    },
  })

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return response._data
})
