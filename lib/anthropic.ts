import { requireEnv } from "@/lib/env";
import { ExtractedActionItem } from "@/lib/types";

type AnthropicExtractResult = {
  summary: string;
  action_items: ExtractedActionItem[];
};

const DEFAULT_MODEL = "claude-3-5-sonnet-latest";

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

function extractJsonObject(text: string): string {
  const stripped = stripCodeFence(text.trim());
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return stripped;
  }

  return stripped.slice(start, end + 1);
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
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = body.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic response did not include text content");
  }

  const extractedJson = extractJsonObject(text);
  const parsed = safeJsonParse<AnthropicExtractResult>(extractedJson);
  if (!parsed) {
    throw new Error("Anthropic output was not valid JSON");
  }

  return normalizeExtraction(parsed);
}
