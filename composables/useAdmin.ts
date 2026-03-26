export const useAdmin = () => {
  const isAuthenticated = () => {
    const cookie = useCookie('admin_session')
    return cookie.value === 'authenticated'
  }

  const logout = () => {
    const cookie = useCookie('admin_session')
    cookie.value = null
    navigateTo('/admin')
  }

  const fetchInsights = () =>
    $fetch('/api/admin/meta-insights')

  const uploadInsights = (form: FormData) =>
    $fetch('/api/admin/upload-insights', { method: 'POST', body: form })

  const scrapeInstagram = (username: string) =>
    $fetch('/api/admin/scrape-instagram', { method: 'POST', body: { username } })

  const generateBrief = (payload: { action: string; customPrompt?: string }) =>
    $fetch('/api/admin/generate-brief', { method: 'POST', body: payload })

  return { isAuthenticated, logout, fetchInsights, uploadInsights, scrapeInstagram, generateBrief }
}
