export default function Home() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 800, padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>Real Estate Call Assistant</h1>
      <p style={{ marginBottom: "0.75rem", lineHeight: 1.5 }}>
        This app receives PLAUD transcripts from Zapier at <code>/api/webhook</code>, extracts
        action items with Anthropic, stores them temporarily, then texts an agent a review link.
      </p>
      <p style={{ lineHeight: 1.5 }}>
        Agents review items on <code>/review?callId=&lt;id&gt;</code> and submit approved items to
        <code> /api/approve</code> to create Google Calendar events and append the call summary to
        a Google Doc for the contact.
      </p>
    </main>
  );
}
