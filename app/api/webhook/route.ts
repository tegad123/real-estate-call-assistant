import { NextRequest, NextResponse } from "next/server";
import { extractActionItemsFromTranscript } from "@/lib/anthropic";
import { createCallRecord } from "@/lib/store";
import { sendSms } from "@/lib/twilio";
import { buildReviewUrl, parseWebhookPayload } from "@/lib/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseRequestBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Unsupported body format. Send JSON or form data.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseWebhookPayload(await parseRequestBody(request));
    const extraction = await extractActionItemsFromTranscript(payload.transcript);

    const record = createCallRecord({
      contactName: payload.contactName,
      contactPhone: payload.contactPhone,
      transcript: payload.transcript,
      summary: extraction.summary,
      extractedItems: extraction.action_items,
    });

    const appBaseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    const reviewUrl = buildReviewUrl(appBaseUrl, record.id);
    const smsRecipient = payload.agentPhone || process.env.REVIEW_SMS_TO_PHONE;
    if (!smsRecipient) {
      throw new Error("Missing SMS recipient: provide agentPhone in webhook or REVIEW_SMS_TO_PHONE");
    }

    await sendSms({
      to: smsRecipient,
      body: `New call action items for ${record.contactName}. Review here: ${reviewUrl}`,
    });

    return NextResponse.json({
      ok: true,
      callId: record.id,
      reviewUrl,
      actionItemCount: record.items.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
