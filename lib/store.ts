import { randomUUID } from "node:crypto";
import { ActionItem, CallRecord, ExtractedActionItem, ItemStatus } from "@/lib/types";

type CallStoreShape = {
  records: Map<string, CallRecord>;
};

declare global {
  // eslint-disable-next-line no-var
  var callStoreSingleton: CallStoreShape | undefined;
}

const store: CallStoreShape =
  global.callStoreSingleton ??
  {
    records: new Map<string, CallRecord>(),
  };

if (!global.callStoreSingleton) {
  global.callStoreSingleton = store;
}

export function createCallRecord(input: {
  contactName: string;
  contactPhone: string;
  transcript: string;
  summary: string;
  extractedItems: ExtractedActionItem[];
}): CallRecord {
  const id = randomUUID();
  const items: ActionItem[] = input.extractedItems.map((item) => ({
    id: randomUUID(),
    title: item.title,
    details: item.details,
    dueAt: item.dueAt,
    status: "pending",
  }));

  const record: CallRecord = {
    id,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    transcript: input.transcript,
    summary: input.summary,
    createdAt: new Date().toISOString(),
    items,
  };

  store.records.set(id, record);
  return record;
}

export function getCallRecord(callId: string): CallRecord | undefined {
  return store.records.get(callId);
}

export function updateItemStatuses(
  callId: string,
  statuses: Record<string, ItemStatus>,
): CallRecord | undefined {
  const record = store.records.get(callId);
  if (!record) {
    return undefined;
  }

  const updatedItems = record.items.map((item) => ({
    ...item,
    status: statuses[item.id] ?? item.status,
  }));

  const updated = {
    ...record,
    items: updatedItems,
  };

  store.records.set(callId, updated);
  return updated;
}
