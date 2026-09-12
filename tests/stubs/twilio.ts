export default function twilio(_a?: any, _b?: any) {
  return { messages: { create: async (_: any) => ({ sid: 'SM_fake' }) } }
}
