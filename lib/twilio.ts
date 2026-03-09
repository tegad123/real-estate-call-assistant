import { requireEnv } from "@/lib/env";

type SendSmsArgs = {
  to: string;
  body: string;
};

export async function sendSms({ to, body }: SendSmsArgs): Promise<void> {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const from = requireEnv("TWILIO_FROM_PHONE");

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const encodedCredentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Basic ${encodedCredentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Twilio SMS send failed: ${response.status} ${errText}`);
  }
}
