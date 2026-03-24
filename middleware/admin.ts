export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/admin') return
  const cookie = useCookie('admin_session')
  if (cookie.value !== 'authenticated') {
    return navigateTo('/admin')
  }
})
