"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { Spinner } from "@/components/Spinner";
import { TxStatus } from "@/components/TxStatus";
import { useLedgerWrite } from "@/lib/chain/useLedgerWrite";
import type { EvidenceReference } from "./EvidenceViewer";
import { DisputePanel } from "./DisputePanel";

type FreelancerSubmissionPanelProps = {
  agreementId: bigint;
  milestoneIndex: number;
  isRevision: boolean;
  canDispute?: boolean;
  disputeDisabledReason?: string;
  onSuccess?: () => void;
};

export function FreelancerSubmissionPanel({
  agreementId,
  milestoneIndex,
  isRevision,
  canDispute = true,
  disputeDisabledReason,
  onSuccess,
}: FreelancerSubmissionPanelProps) {
  const [note, setNote] = useState("");
  const [references, setReferences] = useState<EvidenceReference[]>([
    { label: "", url: "", sha256: "" },
  ]);
  const [submittingBlob, setSubmittingBlob] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tx = useLedgerWrite();

  function updateReference(index: number, field: keyof EvidenceReference, val: string) {
    setReferences((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  function addReference() {
    setReferences((prev) => [...prev, { label: "", url: "", sha256: "" }]);
  }

  function removeReference(index: number) {
    if (references.length <= 1) return;
    setReferences((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanNote = note.trim();
    if (!cleanNote) {
      setError("Please include a note or description for this deliverable submission.");
      return;
    }

    const cleanRefs = references
      .map((r) => ({
        label: r.label.trim(),
        url: r.url?.trim() || undefined,
        sha256: r.sha256?.trim() || undefined,
      }))
      .filter((r) => r.label.length > 0 || r.url || r.sha256);

    const payload = {
      note: cleanNote,
      references: cleanRefs,
    };

    setSubmittingBlob(true);
    let hash: Hex;
    try {
      const res = await fetch("/api/blobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "evidence",
          json: payload,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json()) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to save evidence blob (${res.status})`);
      }

      const body = (await res.json()) as { hash: Hex };
      hash = body.hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to store submission blob.");
      setSubmittingBlob(false);
      return;
    } finally {
      setSubmittingBlob(false);
    }

    await tx.send("submitWork", [agreementId, BigInt(milestoneIndex), hash]);
    if (onSuccess) {
      onSuccess();
    }
  }

  const isBusy =
    submittingBlob || tx.state.status === "awaitingWallet" || tx.state.status === "pending";

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-card border border-stone-soft bg-canvas p-4 text-caption">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-body font-medium text-ink">
          {isRevision ? "Resubmit Deliverable (Revision)" : "Submit Milestone Deliverable"}
        </h3>
        {isRevision && (
          <span className="rounded-tag border border-warning px-2 py-0.5 text-[0.75rem] text-warning">
            Revision requested
          </span>
        )}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor={`evidence-note-${milestoneIndex}`}
            className="mb-1 block font-medium text-ink"
          >
            Deliverable Note / Summary <span className="text-danger">*</span>
          </label>
          <textarea
            id={`evidence-note-${milestoneIndex}`}
            rows={3}
            required
            className="field text-caption"
            placeholder="Describe the deliverable completed, notes for review, or handover details..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-medium text-ink">References & Links (spec 7.4)</label>
            <button
              type="button"
              className="text-lime-deep underline underline-offset-2 hover:text-ink text-[0.8rem]"
              onClick={addReference}
            >
              + Add reference
            </button>
          </div>

          {references.map((ref, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded-tag border border-stone-soft p-3 bg-canvas"
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] font-medium text-muted-on-light">
                  Reference #{idx + 1}
                </span>
                {references.length > 1 && (
                  <button
                    type="button"
                    className="text-danger hover:underline text-[0.75rem]"
                    onClick={() => removeReference(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <input
                    type="text"
                    placeholder="Label (e.g. Figma Source, GitHub PR, Asset Bundle)"
                    className="field text-caption"
                    value={ref.label}
                    onChange={(e) => updateReference(idx, "label", e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="url"
                    placeholder="URL (optional, https://...)"
                    className="field text-caption"
                    value={ref.url ?? ""}
                    onChange={(e) => updateReference(idx, "url", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="SHA-256 checksum (optional file fingerprint)"
                  className="field font-mono text-[0.75rem]"
                  value={ref.sha256 ?? ""}
                  onChange={(e) => updateReference(idx, "sha256", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-danger text-[0.8rem]">
            {error}
          </p>
        )}

        <TxStatus state={tx.state} />

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={isBusy || tx.disabled}>
            {isBusy ? (
              <>
                <Spinner className="mr-2 size-4 animate-spin text-ink" />
                Submitting…
              </>
            ) : isRevision ? (
              "Resubmit work"
            ) : (
              "Submit work"
            )}
          </button>

          {isRevision && (
            <DisputePanel
              agreementId={agreementId}
              milestoneIndex={milestoneIndex}
              role="freelancer"
              canDispute={canDispute}
              disabledReason={disputeDisabledReason}
            />
          )}
        </div>
      </form>
    </div>
  );
}
