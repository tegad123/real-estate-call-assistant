## Real Estate Call Assistant

Next.js app that:
- Receives PLAUD transcripts from Zapier at `POST /api/webhook`
- Uses Anthropic to extract a summary and action items
- Temporarily stores each call record in memory
- Sends a Twilio SMS with a review link
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
  "agentPhone": "+13125550999"
}
```

Accepted aliases:
- `transcript` or `plaudTranscript`
- `contactName` or `leadName`
- `contactPhone` or `leadPhone`
- `agentPhone` or `smsTo`
If no agent phone is sent in the payload, set `REVIEW_SMS_TO_PHONE` in env.

## API Endpoints

- `POST /api/webhook`: extract items, store call, send SMS review link
- `GET /api/review?callId=...`: fetch pending call record
- `POST /api/approve`: approve/dismiss items and sync to Google

## Notes

- Temporary storage is an in-memory Map (`lib/store.ts`). Data resets on server restart/deploy.
- Google integration uses OAuth client credentials plus a refresh token.
- Required Google OAuth scopes for the authorized user: Calendar, Drive, and Docs.
