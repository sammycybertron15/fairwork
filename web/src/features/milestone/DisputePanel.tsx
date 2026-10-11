"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { Spinner } from "@/components/Spinner";
import { TxStatus } from "@/components/TxStatus";
import { useLedgerWrite } from "@/lib/chain/useLedgerWrite";

type DisputePanelProps = {
  agreementId: bigint;
  milestoneIndex: number;
  role: "buyer" | "freelancer";
  canDispute: boolean;
  disabledReason?: string;
  onSuccess?: () => void;
  isOpenControlled?: boolean;
  onCloseControlled?: () => void;
};

export function DisputePanel({
  agreementId,
  milestoneIndex,
  role,
  canDispute,
  disabledReason,
  onSuccess,
  isOpenControlled,
  onCloseControlled,
}: DisputePanelProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submittingBlob, setSubmittingBlob] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmationPopup, setShowConfirmationPopup] = useState(false);

  const tx = useLedgerWrite();

  const isModalOpen = isOpenControlled !== undefined ? isOpenControlled : internalIsOpen;

  function setModalOpen(open: boolean) {
    if (onCloseControlled && !open) {
      onCloseControlled();
    }
    setInternalIsOpen(open);
  }

  // Detect when transaction completes on-chain successfully
  useEffect(() => {
    if (tx.state.status === "confirmed") {
      setShowConfirmationPopup(true);
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [tx.state.status, onSuccess]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("Please state the specific reason for escalating to Customer Support.");
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
          json: {
            reason: cleanReason,
            disputedBy: role,
            milestoneIndex,
            timestamp: Date.now(),
          },
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json()) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to save dispute reason (${res.status})`);
      }

      const body = (await res.json()) as { hash: Hex };
      reasonHash = body.hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to store dispute reason blob.");
      setSubmittingBlob(false);
      return;
    } finally {
      setSubmittingBlob(false);
    }

    await tx.send("raiseDispute", [agreementId, BigInt(milestoneIndex), reasonHash]);
  }

  const isBusy =
    submittingBlob || tx.state.status === "awaitingWallet" || tx.state.status === "pending";

  const buttonLabel =
    role === "buyer"
      ? "Escalate to Customer Support"
      : "Escalate to Customer Support (Challenge Revision)";

  return (
    <>
      {/* Confirmation Pop-up modal after dispute is raised */}
      {showConfirmationPopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispute-confirmed-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-none"
        >
          <div className="w-full max-w-md rounded-panel border border-danger/40 bg-ink p-6 text-canvas shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2.5 text-danger">
              <span aria-hidden className="inline-block size-3 bg-danger" />
              <h3 id="dispute-confirmed-title" className="font-heading text-title font-medium">
                Case Forwarded to Customer Support
              </h3>
            </div>

            <p className="text-body text-canvas leading-relaxed">
              Case forwarded to Fairwork Dispute Desk. Both parties&apos; evidence and terms are
              frozen for review.
            </p>

            <div className="flex items-center gap-2 rounded-tag border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-canvas font-mono">
              <span aria-hidden className="inline-block size-2 bg-danger shrink-0" />
              <span>Payment State: Locked: in dispute</span>
            </div>

            <p className="text-caption text-stone leading-relaxed">
              The designated resolution desk (Account #9 &bull; Fairwork Desk) will evaluate all
              deliverables, review criteria, and negotiation notes to determine the final escrow
              allocation.
            </p>

            <div className="flex justify-end pt-2 border-t border-stone/20">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmationPopup(false);
                  setModalOpen(false);
                }}
                className="rounded-btn bg-lime px-5 py-2 text-lead font-medium text-ink hover:bg-lime-deep transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalation Form Modal */}
      {isModalOpen && !showConfirmationPopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="escalation-modal-title"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-none"
        >
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="w-full max-w-lg rounded-panel border border-danger/40 bg-canvas p-6 text-caption text-ink shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-stone-soft pb-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-block size-2 bg-danger" />
                <h4
                  id="escalation-modal-title"
                  className="font-heading text-title font-medium text-danger"
                >
                  Escalate to Customer Support
                </h4>
              </div>
              <button
                type="button"
                className="text-stone hover:text-ink text-lead font-bold"
                disabled={isBusy}
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <p className="text-[0.82rem] text-muted-on-light leading-relaxed">
              Formal dispute escalation freezes this milestone&apos;s funds in escrow and halts all
              timer actions. Fairwork Customer Support (Account #9) will inspect terms, submissions,
              and negotiation notes to determine binding credit allocation.
            </p>

            <div>
              <label
                htmlFor={`dispute-reason-${milestoneIndex}`}
                className="mb-1 block font-medium text-ink"
              >
                Dispute Reason & Findings <span className="text-danger">*</span>
              </label>
              <textarea
                id={`dispute-reason-${milestoneIndex}`}
                rows={4}
                required
                className="field text-caption leading-relaxed"
                placeholder="State the factual issues with deliverable compliance, acceptance criteria, or revision terms..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-danger text-[0.8rem]">
                {error}
              </p>
            )}

            <TxStatus state={tx.state} />

            <div className="flex items-center justify-end gap-3 border-t border-stone-soft pt-3">
              <button
                type="button"
                className="btn-secondary text-caption"
                disabled={isBusy}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-destructive text-caption inline-flex items-center gap-2"
                disabled={isBusy || !canDispute || tx.disabled}
              >
                {isBusy && <Spinner className="size-3.5 text-danger" />}
                Confirm & Escalate to Support
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Button when used as a standard inline trigger */}
      {!isModalOpen && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="btn-destructive text-caption"
            disabled={!canDispute || isBusy}
            onClick={() => setModalOpen(true)}
          >
            {buttonLabel}
          </button>
          {!canDispute && disabledReason && (
            <p className="text-[0.75rem] text-muted-on-light">{disabledReason}</p>
          )}
        </div>
      )}
    </>
  );
}
