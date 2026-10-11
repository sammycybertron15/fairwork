"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { CopyButton } from "@/components/CopyButton";
import { formatCredits, shortHex } from "@/lib/format";
import { fetchAgreementEvents, type FormattedAgreementEvent } from "@/lib/chain/events";

export function AgreementHistory({ agreementId }: { agreementId: bigint }) {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<FormattedAgreementEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    async function loadEvents() {
      if (!publicClient) return;
      try {
        const items = await fetchAgreementEvents(publicClient, agreementId);
        if (!cancelled) {
          setEvents(items);
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [publicClient, agreementId]);

  if (loading) {
    return (
      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-lead font-medium">
          On-Chain Event History
        </h2>
        <p className="text-caption text-muted-on-light">Loading verified contract events…</p>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-lead font-medium">
          On-Chain Event History
        </h2>
        <p className="text-caption text-muted-on-light">No on-chain events recorded yet.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="history-heading" className="text-lead font-medium">
          On-Chain Event History
        </h2>
        <span className="text-[0.75rem] text-muted-on-light">
          {events.length} {events.length === 1 ? "event" : "events"} recorded
        </span>
      </div>

      <ol className="relative flex flex-col gap-3 border-l border-stone-soft pl-4 ml-2">
        {events.map((ev, idx) => (
          <li key={`${ev.txHash}-${idx}`} className="relative flex flex-col gap-1 text-caption">
            {/* Dot marker */}
            <span
              aria-hidden
              className="absolute -left-[21px] top-1 size-2 rounded-full border border-canvas bg-lime-deep"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">{ev.displayTitle}</span>
              {ev.credits !== undefined && ev.credits > 0n && (
                <span className="font-medium text-lime-deep">{formatCredits(ev.credits)}</span>
              )}
            </div>

            <p className="text-muted-on-light">{ev.description}</p>

            <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-muted-on-light">
              <span className="font-mono">tx: {shortHex(ev.txHash)}</span>
              <CopyButton value={ev.txHash} label="Copy transaction hash" />

              {ev.timestamp > 0n && (
                <span>{new Date(Number(ev.timestamp) * 1000).toLocaleString()}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
