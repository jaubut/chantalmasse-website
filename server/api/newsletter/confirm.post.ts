import { callNewsletterApi, newsletterError } from '~/server/utils/newsletterApi'

const RESULTS = ['confirmed', 'opted_out', 'invalid']

// Called by /confirmer-inscription on a click only, so mail scanners that open
// the link never confirm.
export default defineEventHandler(async (event) => {
  const token = (await readBody(event))?.token
  if (typeof token !== 'string' || !token || token.length > 1024) return { result: 'invalid' }

  const res = await callNewsletterApi(event, 'confirm', { token })
  const result = res._data?.result
  if (res.status === 200 && typeof result === 'string' && RESULTS.includes(result)) return { result }
  newsletterError(res.status)
})
