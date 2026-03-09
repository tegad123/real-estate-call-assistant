import { NextRequest, NextResponse } from "next/server";
import { getCallRecord } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const callId = request.nextUrl.searchParams.get("callId");
  if (!callId) {
    return NextResponse.json({ ok: false, error: "Missing callId query parameter" }, { status: 400 });
  }

  const record = getCallRecord(callId);
  if (!record) {
    return NextResponse.json({ ok: false, error: "Call record not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    record,
  });
}
