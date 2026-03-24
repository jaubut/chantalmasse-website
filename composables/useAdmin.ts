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

  const generateBrief = (payload: { action: string; customPrompt?: string }) =>
    $fetch('/api/admin/generate-brief', { method: 'POST', body: payload })

  return { isAuthenticated, logout, fetchInsights, generateBrief }
}
