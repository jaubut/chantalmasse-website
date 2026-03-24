// Phase 2 stub — scheduled posts management
export default defineEventHandler(async (event) => {
  const session = getCookie(event, 'admin_session')
  if (session !== 'authenticated') {
    throw createError({ statusCode: 401, message: 'Non autorisé' })
  }

  return {
    scheduledPosts: [],
    message: 'Planification de publications — Phase 2',
  }
})
