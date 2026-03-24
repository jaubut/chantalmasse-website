export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()

  if (!body?.password || body.password !== config.adminPassword) {
    throw createError({ statusCode: 401, message: 'Mot de passe incorrect' })
  }

  setCookie(event, 'admin_session', 'authenticated', {
    maxAge: 86400,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })

  return { success: true }
})
