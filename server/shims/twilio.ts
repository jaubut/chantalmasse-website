export default function twilio(accountSid: string, authToken: string) {
  return {
    messages: {
      async create(params: { from: string; to: string; body: string }) {
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: params.from,
              To: params.to,
              Body: params.body,
            }),
          }
        )
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Twilio API error (${res.status}): ${text}`)
        }
        return (await res.json()) as { sid: string; to: string }
      },
    },
  }
}
