export const google = {
  auth: { JWT: class { constructor(_: any) {} } },
  calendar: (_: any) => ({
    events: {
      list: async (_p: any) => ({ data: { items: globalThis.__EVENTS } }),
      patch: async (p: any) => {
        const ev = globalThis.__EVENTS.find((e: any) => e.id === p.eventId)
        if (!ev) throw new Error('no such event')
        if (globalThis.__PATCH_FAIL) throw new Error('patch boom')
        ev.extendedProperties = ev.extendedProperties || {}
        // Google merges extendedProperties.private key-by-key on patch.
        ev.extendedProperties.private = {
          ...(ev.extendedProperties.private || {}),
          ...(p.requestBody.extendedProperties.private || {}),
        }
        globalThis.__PATCHES.push({ eventId: p.eventId, ...p.requestBody.extendedProperties.private })
        return { data: ev }
      },
    },
  }),
}
