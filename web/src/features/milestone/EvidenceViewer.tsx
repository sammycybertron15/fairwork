"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { CopyButton } from "@/components/CopyButton";
import { matchesHash } from "@/lib/terms";
import { shortHex } from "@/lib/format";

export type EvidenceReference = {
  label: string;
  url?: string;
  sha256?: string;
};

export type EvidencePayload = {
  note: string;
  references: EvidenceReference[];
};

export function EvidenceViewer({ evidenceHash }: { evidenceHash: Hex }) {
  const [evidence, setEvidence] = useState<EvidencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHashVerified, setIsHashVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/blobs/${evidenceHash}`);
        if (!res.ok) {
          if (!cancelled) {
            setError("Evidence blob not found on server.");
            setLoading(false);
          }
          return;
        }
        const data = (await res.json()) as { json: unknown };
        if (cancelled) return;

        const verified = matchesHash(data.json, evidenceHash);
        setIsHashVerified(verified);

        const payload = data.json as EvidencePayload;
        setEvidence(payload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load evidence.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [evidenceHash]);

  if (loading) {
    return <p className="text-caption text-muted-on-light">Loading submitted deliverable…</p>;
  }

  if (error || !evidence) {
    return (
      <div className="rounded-tag border border-stone-soft p-3 text-caption text-muted-on-light">
        <p>
          Evidence hash: <span className="font-mono">{shortHex(evidenceHash)}</span>
        </p>
        <p className="mt-1 text-danger">{error ?? "Unable to load evidence details."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-stone-soft bg-canvas p-4 text-caption">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-soft pb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">Submission Evidence</span>
          {isHashVerified === true ? (
            <span className="rounded-tag border border-lime-deep px-1.5 py-0.5 text-[0.75rem] text-lime-deep">
              Verified
            </span>
          ) : isHashVerified === false ? (
            <span className="rounded-tag border border-danger px-1.5 py-0.5 text-[0.75rem] text-danger">
              Hash mismatch
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-muted-on-light">
          <span>{shortHex(evidenceHash)}</span>
          <CopyButton value={evidenceHash} label="Copy evidence hash" />
        </div>
      </div>

      <div>
        <p className="font-medium text-ink">Note / Summary:</p>
        <p className="mt-1 whitespace-pre-wrap text-ink">{evidence.note || "No note provided."}</p>
      </div>

      {evidence.references && evidence.references.length > 0 && (
        <div>
          <p className="font-medium text-ink">References & Deliverable Links:</p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {evidence.references.map((ref, idx) => (
              <li
                key={idx}
                className="flex flex-col gap-0.5 rounded-tag border border-stone-soft p-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{ref.label}</span>
                  {ref.url && (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lime-deep underline underline-offset-2 hover:text-ink"
                    >
                      Open link ↗
                    </a>
                  )}
                </div>
                {ref.sha256 && (
                  <p className="font-mono text-[0.8rem] text-muted-on-light">
                    SHA-256: {ref.sha256}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
