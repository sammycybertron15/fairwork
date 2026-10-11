"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { Spinner } from "@/components/Spinner";
import { TxStatus } from "@/components/TxStatus";
import { useLedgerWrite } from "@/lib/chain/useLedgerWrite";
import { formatCredits, shortHex } from "@/lib/format";
import type { DisputeMessage } from "@/lib/db/blobs";

type ResolverSettlementPanelProps = {
  agreementId: bigint;
  milestoneIndex: number;
  credits: bigint;
  onSuccess?: () => void;
  milestoneTitle?: string;
  acceptanceCriteria?: string[];
  deliverables?: string[];
  evidenceHash?: string;
};

type EvidenceData = {
  note?: string;
  references?: Array<{ label: string; url: string }>;
};

export function ResolverSettlementPanel({
  agreementId,
  milestoneIndex,
  credits,
  onSuccess,
  milestoneTitle,
  acceptanceCriteria = [],
  deliverables = [],
  evidenceHash,
}: ResolverSettlementPanelProps) {
  const [percent, setPercent] = useState<number>(50); // Default to 50/50 split
  const [rationale, setRationale] = useState("");
  const [submittingBlob, setSubmittingBlob] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automated summary state
  const [evidenceData, setEvidenceData] = useState<EvidenceData | null>(null);
  const [disputeMessages, setDisputeMessages] = useState<DisputeMessage[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const tx = useLedgerWrite();

  const totalCredits = Number(credits);
  const toFreelancer = Math.round((totalCredits * percent) / 100);
  const toBuyer = totalCredits - toFreelancer;

  const agreementIdStr = agreementId.toString();

  // Load automated summary: evidence and dispute messages
  useEffect(() => {
    let cancelled = false;
    async function loadAutomatedSummary() {
      try {
        // 1. Fetch submission note if evidenceHash is available
        if (evidenceHash && evidenceHash !== "0x" + "0".repeat(64)) {
          try {
            const evRes = await fetch(`/api/blobs/${evidenceHash}`);
            if (evRes.ok) {
              const evBlob = await evRes.json();
              if (!cancelled && evBlob.json) {
                setEvidenceData(evBlob.json as EvidenceData);
              }
            }
          } catch {
            // ignore
          }
        }

        // 2. Fetch dispute notes and negotiation thread
        try {
          const msgRes = await fetch(
            `/api/dispute-messages?agreementId=${encodeURIComponent(agreementIdStr)}&milestoneIndex=${milestoneIndex}`,
          );
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            if (!cancelled && msgData.messages) {
              setDisputeMessages(msgData.messages);
            }
          }
        } catch {
          // ignore
        }
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    }

    void loadAutomatedSummary();
    return () => {
      cancelled = true;
    };
  }, [evidenceHash, agreementIdStr, milestoneIndex]);

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanRationale = rationale.trim();
    if (!cleanRationale) {
      setError("Please provide a written rationale explaining your settlement decision.");
      return;
    }

    setSubmittingBlob(true);
    let rationaleHash: Hex;
    try {
      const res = await fetch("/api/blobs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "rationale",
          json: {
            rationale: cleanRationale,
            toFreelancer,
            toBuyer,
            splitPercentToFreelancer: percent,
            milestoneIndex,
            timestamp: Date.now(),
          },
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json()) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to store rationale blob (${res.status})`);
      }

      const body = (await res.json()) as { hash: Hex };
      rationaleHash = body.hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to store settlement rationale.");
      setSubmittingBlob(false);
      return;
    } finally {
      setSubmittingBlob(false);
    }

    await tx.send("resolveDispute", [
      agreementId,
      BigInt(milestoneIndex),
      BigInt(toFreelancer),
      rationaleHash,
    ]);

    if (onSuccess) {
      onSuccess();
    }
  }

  const isBusy =
    submittingBlob || tx.state.status === "awaitingWallet" || tx.state.status === "pending";

  return (
    <form
      onSubmit={(e) => void handleSettle(e)}
      className="mt-3 flex flex-col gap-5 rounded-panel border border-lime-deep/40 bg-ink p-5 sm:p-6 text-caption text-canvas shadow-xl"
    >
      {/* Header: Rebranded to Fairwork Support Resolution Desk */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone/20 pb-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="inline-block size-2.5 bg-lime shrink-0" />
          <h3 className="font-heading text-title font-medium text-lime">
            Fairwork Support Resolution Desk
          </h3>
        </div>
        <span className="rounded-tag border border-lime/40 bg-lime/10 px-2.5 py-1 text-[0.75rem] font-mono text-lime font-medium">
          Account #9 &bull; Authorized Support Desk
        </span>
      </div>

      <p className="text-[0.82rem] text-stone leading-relaxed">
        As the designated customer support resolver, you hold binding on-chain authority to
        adjudicate this disputed milestone and partition the locked escrow (
        <span className="font-medium text-canvas">{formatCredits(credits)}</span>).
      </p>

      {/* Automated Dispute Summary Panel */}
      <div className="flex flex-col gap-3 rounded-card border border-stone/20 bg-stone/5 p-4">
        <div className="flex items-center justify-between border-b border-stone/15 pb-2">
          <h4 className="font-heading font-medium text-canvas">Automated Dispute Case Summary</h4>
          {loadingSummary && (
            <span className="text-[0.75rem] text-stone animate-pulse">Loading case files…</span>
          )}
        </div>

        {/* 1. Milestone Criteria */}
        <div>
          <span className="font-medium text-stone block mb-1">
            Milestone Criteria {milestoneTitle ? `(${milestoneTitle})` : ""}:
          </span>
          {acceptanceCriteria.length > 0 || deliverables.length > 0 ? (
            <div className="space-y-1.5 pl-2 text-[0.8rem] text-canvas">
              {deliverables.length > 0 && (
                <div>
                  <span className="text-stone">Deliverables:</span> {deliverables.join(", ")}
                </div>
              )}
              {acceptanceCriteria.length > 0 && (
                <div>
                  <span className="text-stone">Acceptance Criteria:</span>{" "}
                  {acceptanceCriteria.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[0.8rem] text-stone italic pl-2">
              Deliverable scope defined in agreement terms.
            </p>
          )}
        </div>

        {/* 2. Freelancer Submission Note */}
        <div>
          <span className="font-medium text-stone block mb-1">Freelancer Submission Note:</span>
          {evidenceData?.note ? (
            <div className="rounded-tag border border-stone/20 bg-ink/70 p-2.5 text-[0.8rem] text-canvas leading-relaxed">
              &ldquo;{evidenceData.note}&rdquo;
              {evidenceData.references && evidenceData.references.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-stone/20 flex flex-wrap gap-2">
                  <span className="text-stone">Links:</span>
                  {evidenceData.references.map((r, i) => (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lime underline hover:text-canvas"
                    >
                      {r.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[0.8rem] text-stone italic pl-2">
              {evidenceHash ? "Evidence hash recorded on chain." : "No submission note filed."}
            </p>
          )}
        </div>

        {/* 3. Dispute Messages & Negotiation History */}
        <div>
          <span className="font-medium text-stone block mb-1">Dispute & Negotiation Notes:</span>
          {disputeMessages.length > 0 ? (
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {disputeMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-tag border border-stone/15 bg-ink/60 p-2 text-[0.78rem]"
                >
                  <div className="flex items-center justify-between text-stone text-[0.7rem] mb-0.5">
                    <span className="font-mono text-lime font-medium uppercase">
                      {msg.senderRole}: {shortHex(msg.senderAddress)}
                    </span>
                    <span>
                      {new Date(msg.createdAt * 1000).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-canvas leading-relaxed">{msg.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.8rem] text-stone italic pl-2">
              No dispute notes posted in thread. Disputed directly through on-chain escalation.
            </p>
          )}
        </div>
      </div>

      {/* Settlement Control & Quick Presets */}
      <div className="flex flex-col gap-3 rounded-card border border-stone/20 bg-stone/5 p-4">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`split-slider-${milestoneIndex}`}
            className="font-medium text-canvas text-body"
          >
            Escrow Split Allocation: {percent}% to Freelancer
          </label>
          <span className="text-stone text-[0.8rem]">{100 - percent}% refund to Buyer</span>
        </div>

        {/* Quick Presets Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-stone text-[0.75rem] font-medium mr-1">Quick Presets:</span>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setPercent(50)}
            className={`rounded-tag border px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
              percent === 50
                ? "border-lime bg-lime text-ink"
                : "border-stone/40 bg-ink text-canvas hover:border-lime"
            }`}
          >
            50/50 Split
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setPercent(0)}
            className={`rounded-tag border px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
              percent === 0
                ? "border-lime bg-lime text-ink"
                : "border-stone/40 bg-ink text-canvas hover:border-lime"
            }`}
          >
            Full Refund to Buyer (0%)
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setPercent(100)}
            className={`rounded-tag border px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
              percent === 100
                ? "border-lime bg-lime text-ink"
                : "border-stone/40 bg-ink text-canvas hover:border-lime"
            }`}
          >
            Full Payout to Freelancer (100%)
          </button>
        </div>

        {/* Interactive Slider */}
        <input
          id={`split-slider-${milestoneIndex}`}
          type="range"
          min="0"
          max="100"
          step="1"
          value={percent}
          disabled={isBusy}
          onChange={(e) => setPercent(Number(e.target.value))}
          className="w-full accent-lime cursor-pointer mt-1"
        />

        {/* Real-Time Exact Numbers */}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-stone/20 pt-2 font-mono text-[0.85rem]">
          <div className="flex items-center gap-1.5 text-lime">
            <span>Freelancer:</span>
            <span className="font-semibold">{toFreelancer.toLocaleString()} credits</span>
          </div>
          <div className="flex items-center gap-1.5 text-canvas">
            <span>Buyer Refund:</span>
            <span className="font-semibold">{toBuyer.toLocaleString()} credits</span>
          </div>
        </div>
      </div>

      {/* Rationale Textarea */}
      <div>
        <label
          htmlFor={`rationale-${milestoneIndex}`}
          className="mb-1 block font-medium text-canvas"
        >
          Arbitration Findings & Settlement Rationale <span className="text-danger">*</span>
        </label>
        <textarea
          id={`rationale-${milestoneIndex}`}
          rows={3}
          required
          className="w-full rounded-input border border-stone/30 bg-ink px-3 py-2 text-canvas placeholder:text-stone/60 focus:border-lime focus:outline-none text-caption leading-relaxed"
          placeholder="State the factual basis for this split (e.g. deliverable satisfied 50% of acceptance criteria; balance refunded to buyer)..."
          value={rationale}
          disabled={isBusy}
          onChange={(e) => setRationale(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-danger text-[0.8rem]">
          {error}
        </p>
      )}

      <TxStatus state={tx.state} />

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone/20">
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-btn bg-lime px-6 py-2 text-lead font-medium text-ink hover:bg-lime-deep transition-colors shadow-md"
          disabled={isBusy || tx.disabled}
        >
          {isBusy ? (
            <>
              <Spinner className="size-4 animate-spin text-ink" />
              Executing on-chain settlement…
            </>
          ) : (
            `Issue Resolution (${toFreelancer} / ${toBuyer})`
          )}
        </button>
      </div>
    </form>
  );
}
