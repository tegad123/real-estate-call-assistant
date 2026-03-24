import { requireEnv } from "@/lib/env";
import { ExtractedActionItem } from "@/lib/types";

type AnthropicExtractResult = {
  summary: string;
  action_items: ExtractedActionItem[];
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function sanitizeJsonCandidate(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractJsonCandidates(text: string): string[] {
  const stripped = stripCodeFence(text.trim());
  const candidates = new Set<string>([stripped]);

  let depth = 0;
  let start = -1;

  for (let i = 0; i < stripped.length; i += 1) {
    const char = stripped[i];

    if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        candidates.add(stripped.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return [...candidates].map((value) => value.trim()).filter(Boolean);
}

function normalizeExtraction(result: AnthropicExtractResult): AnthropicExtractResult {
  const summary = result.summary?.trim() || "No summary generated.";
  const action_items = Array.isArray(result.action_items)
    ? result.action_items
        .map((item) => ({
          title: item.title?.trim(),
          details: item.details?.trim() || undefined,
          dueAt: item.dueAt?.trim() || undefined,
        }))
        .filter((item) => item.title)
        .slice(0, 20)
    : [];

  return { summary, action_items };
}

function parseExtractionFromUnknown(value: unknown): AnthropicExtractResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybe = value as {
    summary?: unknown;
    action_items?: unknown;
  };

  if (typeof maybe.summary !== "string") {
    return null;
  }

  const action_items = Array.isArray(maybe.action_items)
    ? (maybe.action_items as ExtractedActionItem[])
    : [];

  return normalizeExtraction({
    summary: maybe.summary,
    action_items,
  });
}

function parseExtractionFromText(text: string): AnthropicExtractResult | null {
  const candidates = extractJsonCandidates(text);

  for (const candidate of candidates) {
    const parsed =
      safeJsonParse<AnthropicExtractResult>(candidate) ||
      safeJsonParse<AnthropicExtractResult>(sanitizeJsonCandidate(candidate));

    if (parsed) {
      return normalizeExtraction(parsed);
    }
  }

  return null;
}

function fallbackExtraction(text: string): AnthropicExtractResult {
  const summary = text.replace(/\s+/g, " ").trim().slice(0, 600);

  return normalizeExtraction({
    summary: summary || "Summary unavailable from model output.",
    action_items: [],
  });
}

export async function extractActionItemsFromTranscript(
  transcript: string,
): Promise<AnthropicExtractResult> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const system = [
    "You are an assistant for a real estate agent.",
    "Extract concrete follow-up action items from a call transcript.",
    "Return ONLY valid JSON with shape:",
    '{ "summary": string, "action_items": [{ "title": string, "details"?: string, "dueAt"?: string }] }',
    "Rules:",
    "- Keep summary concise (2-4 sentences).",
    "- Action item titles must be imperative and specific.",
    "- dueAt should be ISO 8601 if clear, otherwise omit.",
    "- Never include markdown or extra keys.",
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.1,
      system,
      messages: [
        {
          role: "user",
          content: `Transcript:\n${transcript}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${errText}`);
  }

  const body = (await response.json()) as {
    content?: Array<{ type?: string; text?: string; input?: unknown }>;
  };

  const toolInput = body.content?.find((part) => part.type === "tool_use")?.input;
  const parsedFromTool = parseExtractionFromUnknown(toolInput);
  if (parsedFromTool) {
    return parsedFromTool;
  }

  const text = body.content
    ?.filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic response did not include text content");
  }

  const parsed = parseExtractionFromText(text);
  if (parsed) {
    return parsed;
  }

  return fallbackExtraction(text);
}
