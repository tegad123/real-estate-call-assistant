import { requireEnv } from "@/lib/env";

export type EmailProvider = "none" | "webhook";

export type NotifyReviewEmailInput = {
  to?: string;
  subject: string;
  body: string;
  reviewUrl: string;
  contactName: string;
  callId: string;
};

export type NotifyReviewEmailResult = {
  provider: EmailProvider;
  sent: boolean;
  recipient: string | null;
};

function getEmailProvider(): EmailProvider {
  const configured = (process.env.EMAIL_PROVIDER || "none").toLowerCase();
  if (configured === "webhook") {
    return configured;
  }
  return "none";
}

async function sendViaWebhook(input: NotifyReviewEmailInput): Promise<void> {
  const webhookUrl = requireEnv("EMAIL_WEBHOOK_URL");
  const token = process.env.EMAIL_WEBHOOK_TOKEN;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      message: input.body,
      reviewUrl: input.reviewUrl,
      contactName: input.contactName,
      callId: input.callId,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Email webhook send failed: ${response.status} ${errText}`);
  }
}

export async function notifyReviewLinkEmail(
  input: NotifyReviewEmailInput,
): Promise<NotifyReviewEmailResult> {
  const provider = getEmailProvider();
  const recipient = input.to || null;

  if (provider === "none") {
    return {
      provider,
      sent: false,
      recipient,
    };
  }

  if (!input.to) {
    throw new Error("Missing review recipient email: provide agentEmail in webhook or REVIEW_EMAIL_TO");
  }

  await sendViaWebhook(input);
  return {
    provider,
    sent: true,
    recipient,
  };
}
