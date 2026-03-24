import { ParsedWebhookPayload } from "@/lib/types";

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function pickFromCandidates(
  sources: Array<Record<string, unknown> | undefined>,
  keys: string[],
): string | undefined {
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const match = pickString(source, keys);
    if (match) {
      return match;
    }
  }
  return undefined;
}

export function parseWebhookPayload(raw: unknown): ParsedWebhookPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Webhook body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const nestedCandidates = [
    body.data,
    body.payload,
    body.plaud,
    body.inputData,
  ].filter((value): value is Record<string, unknown> => !!value && typeof value === "object");

  const sources = [body, ...nestedCandidates];

  const transcript = pickFromCandidates(sources, [
    "transcript",
    "plaudTranscript",
    "callTranscript",
    "text",
  ]);
  if (!transcript) {
    throw new Error("Missing transcript in webhook payload");
  }

  const contactName =
    pickFromCandidates(sources, ["contactName", "leadName", "name"]) || "Unknown Contact";
  const contactPhone =
    pickFromCandidates(sources, ["contactPhone", "leadPhone", "phone"]) || "Unknown";
  const agentEmail =
    pickFromCandidates(sources, ["agentEmail", "reviewEmail", "email", "agent_email"]) || "";

  return {
    transcript,
    contactName,
    contactPhone,
    agentEmail,
  };
}

export function buildReviewUrl(baseUrl: string, callId: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBaseUrl}/review?callId=${encodeURIComponent(callId)}`;
}
