import { google } from "googleapis";
import { requireEnv } from "@/lib/env";
import type { ActionItem } from "@/lib/types";

type AppendSummaryArgs = {
  contactName: string;
  contactPhone: string;
  summary: string;
  approvedItems: ActionItem[];
  callTimestamp: string;
};

function contactDocName(contactName: string, contactPhone: string): string {
  return `Call Summary - ${contactName} (${contactPhone})`;
}

function getGoogleAuth() {
  const clientId = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = requireEnv("GOOGLE_OAUTH_REFRESH_TOKEN");
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000";

  const oauthClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauthClient.setCredentials({
    refresh_token: refreshToken,
  });

  return oauthClient;
}

function parseDueAt(dueAt?: string): Date | null {
  if (!dueAt) {
    return null;
  }

  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function createCalendarEvents(
  approvedItems: ActionItem[],
  contactName: string,
): Promise<number> {
  if (!approvedItems.length) {
    return 0;
  }

  const auth = getGoogleAuth();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = requireEnv("GOOGLE_CALENDAR_ID");
  const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE || "America/Chicago";

  let createdCount = 0;
  for (const item of approvedItems) {
    const due = parseDueAt(item.dueAt);
    const start = due ?? new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: item.title,
        description: [
          `Contact: ${contactName}`,
          item.details ? `Details: ${item.details}` : "",
          item.dueAt ? `Original dueAt: ${item.dueAt}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        start: {
          dateTime: start.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: timezone,
        },
      },
    });
    createdCount += 1;
  }

  return createdCount;
}

async function findContactDocId(
  drive: ReturnType<typeof google.drive>,
  contactName: string,
  contactPhone: string,
): Promise<string | null> {
  const escapedDocName = contactDocName(contactName, contactPhone).replace(/'/g, "\\'");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const queryParts = [
    "mimeType='application/vnd.google-apps.document'",
    "trashed=false",
    `name='${escapedDocName}'`,
  ];
  if (folderId) {
    queryParts.push(`'${folderId}' in parents`);
  }

  const search = await drive.files.list({
    q: queryParts.join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
  });

  return search.data.files?.[0]?.id ?? null;
}

async function createContactDoc(
  drive: ReturnType<typeof google.drive>,
  contactName: string,
  contactPhone: string,
): Promise<string> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const created = await drive.files.create({
    requestBody: {
      name: contactDocName(contactName, contactPhone),
      mimeType: "application/vnd.google-apps.document",
      ...(folderId ? { parents: [folderId] } : {}),
    },
    fields: "id",
  });

  const docId = created.data.id;
  if (!docId) {
    throw new Error("Unable to create Google Doc for contact");
  }

  return docId;
}

export async function appendCallSummaryToContactDoc({
  contactName,
  contactPhone,
  summary,
  approvedItems,
  callTimestamp,
}: AppendSummaryArgs): Promise<string> {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  const existingDocId = await findContactDocId(drive, contactName, contactPhone);
  const docId = existingDocId ?? (await createContactDoc(drive, contactName, contactPhone));

  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = doc.data.body?.content?.at(-1)?.endIndex ?? 1;

  const section = [
    `\n\n=== Call ${new Date(callTimestamp).toLocaleString()} ===`,
    `Contact: ${contactName} (${contactPhone})`,
    `Summary: ${summary}`,
    "Approved Action Items:",
    ...approvedItems.map((item, index) => {
      const due = item.dueAt ? ` | Due: ${item.dueAt}` : "";
      const details = item.details ? ` | ${item.details}` : "";
      return `${index + 1}. ${item.title}${due}${details}`;
    }),
  ].join("\n");

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: Math.max(1, endIndex - 1) },
            text: section,
          },
        },
      ],
    },
  });

  return docId;
}
