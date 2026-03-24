## Real Estate Call Assistant

Next.js app that:
- Receives PLAUD transcripts from Zapier at `POST /api/webhook`
- Uses Anthropic to extract a summary and action items
- Temporarily stores each call record in memory
- Produces/sends an email review link (provider-based: SMTP, webhook, or Zapier-managed)
- Lets the agent approve/dismiss each item on `/review`
- On submit (`POST /api/approve`), creates Google Calendar events and appends a call summary to a contact-specific Google Doc

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Fill in all API credentials in `.env.local`.
Required Google vars:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN` (offline token for the Google user whose Calendar/Drive/Docs should be updated)
- Optional: `GOOGLE_OAUTH_REDIRECT_URI`
Email vars:
- `EMAIL_PROVIDER` = `none` | `webhook`
- `REVIEW_EMAIL_TO` (fallback recipient if payload does not include `agentEmail`)
- If `EMAIL_PROVIDER=webhook`: set `EMAIL_WEBHOOK_URL` (and optional `EMAIL_WEBHOOK_TOKEN`)

4. Run the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Webhook Payload

Zapier should `POST` JSON like:

```json
{
  "transcript": "PLAUD transcript text...",
  "contactName": "Jane Buyer",
  "contactPhone": "+13125550123",
  "agentEmail": "agent@example.com"
}
```

Accepted aliases:
- `transcript` or `plaudTranscript`
- `contactName` or `leadName`
- `contactPhone` or `leadPhone`
- `agentEmail` or `reviewEmail`
If no recipient is sent in the payload, set `REVIEW_EMAIL_TO` in env.

## API Endpoints

- `POST /api/webhook`: extract items, store call, and deliver or return email review payload
- `GET /api/review?callId=...`: fetch pending call record
- `POST /api/approve`: approve/dismiss items and sync to Google

## Notes

- Temporary storage is an in-memory Map (`lib/store.ts`). Data resets on server restart/deploy.
- Google integration uses OAuth client credentials plus a refresh token.
- Required Google OAuth scopes for the authorized user: Calendar, Drive, and Docs.
- If `EMAIL_PROVIDER=none`, `/api/webhook` returns `email.to` + `email.subject` + `email.body` so Zapier can send via any mail step.
