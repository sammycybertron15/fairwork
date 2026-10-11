"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { Spinner } from "@/components/Spinner";
import { TxStatus } from "@/components/TxStatus";
import { useLedgerWrite } from "@/lib/chain/useLedgerWrite";
import { EvidenceViewer } from "./EvidenceViewer";
import { DisputePanel } from "./DisputePanel";

type BuyerReviewPanelProps = {
  agreementId: bigint;
  milestoneIndex: number;
  evidenceHash: Hex;
  canAccept: boolean;
  canRequestRevision: boolean;
  revisionDisabledReason?: string;
  canDispute?: boolean;
  disputeDisabledReason?: string;
  revisionsUsed: number;
  revisionLimit: number;
};

export function BuyerReviewPanel({
  agreementId,
  milestoneIndex,
  evidenceHash,
  canAccept,
  canRequestRevision,
  revisionDisabledReason,
  canDispute = false,
  disputeDisabledReason,
  revisionsUsed,
  revisionLimit,
}: BuyerReviewPanelProps) {
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [submittingBlob, setSubmittingBlob] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptTx = useLedgerWrite();
  const revisionTx = useLedgerWrite();

  async function handleAccept() {
    setError(null);
    await acceptTx.send("acceptWork", [agreementId, BigInt(milestoneIndex)]);
  }

  async function handleRequestRevision(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanReason = revisionReason.trim();
    if (!cleanReason) {
      setError("Please provide a reason or required changes for the revision request.");
      return;
    }

    setSubmittingBlob(true);
    let reasonHash: Hex;
    try {
      const res = await fetch("/api/blobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "reason",
          json: { reason: cleanReason },
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json()) as { error?: { message?: string } };
        throw new Error(
          errJson.error?.message ?? `Failed to store revision reason (${res.status})`,
        );
      }

      const body = (await res.json()) as { hash: Hex };
      reasonHash = body.hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to store revision reason blob.");
      setSubmittingBlob(false);
      return;
    } finally {
      setSubmittingBlob(false);
    }

    await revisionTx.send("requestRevision", [agreementId, BigInt(milestoneIndex), reasonHash]);
  }

  const isBusy =
    submittingBlob ||
    acceptTx.state.status === "awaitingWallet" ||
    acceptTx.state.status === "pending" ||
    revisionTx.state.status === "awaitingWallet" ||
    revisionTx.state.status === "pending";

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-card border border-stone-soft bg-canvas p-4 text-caption">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-body font-medium text-ink">Buyer Review Panel</h3>
        <span className="rounded-tag border border-lime-deep px-2 py-0.5 text-[0.75rem] text-lime-deep">
          Deliverable submitted
        </span>
      </div>

      {/* Render evidence viewer for submitted evidence */}
      <EvidenceViewer evidenceHash={evidenceHash} />

      {error && (
        <p role="alert" className="text-danger text-[0.8rem]">
          {error}
        </p>
      )}

      {/* Statuses for writes */}
      <TxStatus state={acceptTx.state} />
      <TxStatus state={revisionTx.state} />

      {/* Action controls */}
      {!showRevisionForm ? (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary text-caption"
              disabled={isBusy || !canAccept || acceptTx.disabled}
              onClick={() => void handleAccept()}
            >
              {acceptTx.disabled &&
              (acceptTx.state.status === "awaitingWallet" ||
                acceptTx.state.status === "pending") ? (
                <>
                  <Spinner className="mr-2 size-4 animate-spin text-ink" />
                  Accepting…
                </>
              ) : (
                "Accept work & release credits"
              )}
            </button>

            <button
              type="button"
              className="btn-secondary text-caption"
              disabled={isBusy || !canRequestRevision}
              onClick={() => setShowRevisionForm(true)}
            >
              Request revision ({revisionsUsed} / {revisionLimit} used)
            </button>

            <DisputePanel
              agreementId={agreementId}
              milestoneIndex={milestoneIndex}
              role="buyer"
              canDispute={canDispute}
              disabledReason={disputeDisabledReason}
            />
          </div>

          {!canRequestRevision && revisionDisabledReason && (
            <p className="text-caption text-muted-on-light">
              Revision unavailable: {revisionDisabledReason}
            </p>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleRequestRevision(e)}
          className="flex flex-col gap-3 pt-2 border-t border-stone-soft"
        >
          <div className="flex items-center justify-between">
            <label htmlFor={`revision-reason-${milestoneIndex}`} className="font-medium text-ink">
              Reason / Feedback for Revision ({revisionsUsed + 1} of {revisionLimit}){" "}
              <span className="text-danger">*</span>
            </label>
            <button
              type="button"
              className="text-muted-on-light hover:text-ink text-[0.8rem]"
              onClick={() => setShowRevisionForm(false)}
            >
              Cancel
            </button>
          </div>

          <textarea
            id={`revision-reason-${milestoneIndex}`}
            rows={3}
            required
            className="field text-caption"
            placeholder="Explain specifically what adjustments or corrections are requested..."
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn-secondary text-caption"
              disabled={isBusy || revisionTx.disabled || !canRequestRevision}
            >
              {isBusy ? "Submitting revision request…" : "Send revision request"}
            </button>
            <button
              type="button"
              className="btn-secondary text-caption"
              disabled={isBusy}
              onClick={() => setShowRevisionForm(false)}
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
