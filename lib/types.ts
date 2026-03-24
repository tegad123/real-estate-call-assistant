export type ItemStatus = "pending" | "approved" | "dismissed";

export type ActionItem = {
  id: string;
  title: string;
  details?: string;
  dueAt?: string;
  status: ItemStatus;
};

export type CallRecord = {
  id: string;
  contactName: string;
  contactPhone: string;
  transcript: string;
  summary: string;
  createdAt: string;
  items: ActionItem[];
};

export type ParsedWebhookPayload = {
  transcript: string;
  contactName: string;
  contactPhone: string;
  agentEmail: string;
};

export type ExtractedActionItem = {
  title: string;
  details?: string;
  dueAt?: string;
};
