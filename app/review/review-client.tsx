"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CallRecord, ItemStatus } from "@/lib/types";
import styles from "@/app/review/review.module.css";

type ReviewResponse = {
  ok: boolean;
  error?: string;
  record?: CallRecord;
};

type ApprovalResponse = {
  ok: boolean;
  error?: string;
  approvedCount?: number;
  calendarEventsCreated?: number;
  docUrl?: string;
};

export default function ReviewClient() {
  const searchParams = useSearchParams();
  const callId = searchParams.get("callId") ?? "";

  const [record, setRecord] = useState<CallRecord | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<ApprovalResponse | null>(null);

  useEffect(() => {
    if (!callId) {
      setError("Missing callId in URL");
      setLoading(false);
      return;
    }

    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/review?callId=${encodeURIComponent(callId)}`);
        const body = (await response.json()) as ReviewResponse;
        if (!response.ok || !body.ok || !body.record) {
          throw new Error(body.error || "Failed to load call record");
        }

        if (!mounted) {
          return;
        }

        setRecord(body.record);
        const defaults = Object.fromEntries(
          body.record.items.map((item) => [item.id, item.status || "pending"]),
        ) as Record<string, ItemStatus>;
        setStatuses(defaults);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown load error";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, [callId]);

  const pendingCount = useMemo(() => {
    if (!record) {
      return 0;
    }
    return record.items.filter((item) => statuses[item.id] === "pending").length;
  }, [record, statuses]);

  const approvedItemIds = useMemo(() => {
    if (!record) {
      return [];
    }
    return record.items.filter((item) => statuses[item.id] === "approved").map((item) => item.id);
  }, [record, statuses]);

  const dismissedItemIds = useMemo(() => {
    if (!record) {
      return [];
    }
    return record.items.filter((item) => statuses[item.id] === "dismissed").map((item) => item.id);
  }, [record, statuses]);

  async function handleSubmit() {
    if (!record) {
      return;
    }
    if (pendingCount > 0) {
      setError("Please approve or dismiss every item before submitting.");
      return;
    }

    try {
      setError("");
      setSubmitting(true);
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          callId: record.id,
          approvedItemIds,
          dismissedItemIds,
        }),
      });

      const body = (await response.json()) as ApprovalResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Approval request failed");
      }

      setResult(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown submit error";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className={styles.page}>Loading call details...</main>;
  }

  if (error && !record) {
    return <main className={styles.page}>Error: {error}</main>;
  }

  if (!record) {
    return <main className={styles.page}>No call record found.</main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>Review Call Action Items</h1>
        <p className={styles.meta}>
          Contact: <strong>{record.contactName}</strong> ({record.contactPhone})
        </p>
        <p className={styles.summary}>{record.summary}</p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.subtitle}>Action Items</h2>
        <ul className={styles.list}>
          {record.items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div>
                <p className={styles.itemTitle}>{item.title}</p>
                {item.details ? <p className={styles.itemDetails}>{item.details}</p> : null}
                {item.dueAt ? <p className={styles.itemDue}>Due: {item.dueAt}</p> : null}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={statuses[item.id] === "approved" ? styles.activeApprove : styles.button}
                  onClick={() => setStatuses((prev) => ({ ...prev, [item.id]: "approved" }))}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={statuses[item.id] === "dismissed" ? styles.activeDismiss : styles.button}
                  onClick={() => setStatuses((prev) => ({ ...prev, [item.id]: "dismissed" }))}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button type="button" className={styles.submit} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Decisions"}
        </button>
        <p className={styles.pending}>Pending decisions: {pendingCount}</p>

        {result?.ok ? (
          <div className={styles.result}>
            <p>Approved items: {result.approvedCount}</p>
            <p>Calendar events created: {result.calendarEventsCreated}</p>
            {result.docUrl ? (
              <p>
                Contact doc:{" "}
                <a href={result.docUrl} target="_blank" rel="noreferrer">
                  Open Google Doc
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
