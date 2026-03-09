import { NextRequest, NextResponse } from "next/server";
import { appendCallSummaryToContactDoc, createCalendarEvents } from "@/lib/google";
import { getCallRecord, updateItemStatuses } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApproveRequestBody = {
  callId?: string;
  approvedItemIds?: string[];
  dismissedItemIds?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ApproveRequestBody;
    const callId = body.callId;

    if (!callId) {
      return NextResponse.json({ ok: false, error: "Missing callId" }, { status: 400 });
    }

    const record = getCallRecord(callId);
    if (!record) {
      return NextResponse.json({ ok: false, error: "Call record not found" }, { status: 404 });
    }

    const approvedSet = new Set(body.approvedItemIds ?? []);
    const dismissedSet = new Set(body.dismissedItemIds ?? []);

    const statuses: Record<string, "approved" | "dismissed"> = {};
    for (const item of record.items) {
      if (approvedSet.has(item.id)) {
        statuses[item.id] = "approved";
      } else if (dismissedSet.has(item.id)) {
        statuses[item.id] = "dismissed";
      }
    }

    const updated = updateItemStatuses(callId, statuses);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Unable to update call record" }, { status: 500 });
    }

    const approvedItems = updated.items.filter((item) => item.status === "approved");
    const calendarEventsCreated = await createCalendarEvents(approvedItems, updated.contactName);
    const docId = await appendCallSummaryToContactDoc({
      contactName: updated.contactName,
      contactPhone: updated.contactPhone,
      summary: updated.summary,
      approvedItems,
      callTimestamp: updated.createdAt,
    });

    return NextResponse.json({
      ok: true,
      callId: updated.id,
      approvedCount: approvedItems.length,
      calendarEventsCreated,
      docId,
      docUrl: `https://docs.google.com/document/d/${docId}/edit`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown approve error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
