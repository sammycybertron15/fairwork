"use client";

import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { CopyButton } from "@/components/CopyButton";
import { Spinner } from "@/components/Spinner";
import { TxStatus } from "@/components/TxStatus";
import { useAgreement, useAvailableOf, useMilestones } from "@/lib/chain/hooks";
import { useLedgerWrite } from "@/lib/chain/useLedgerWrite";
import { formatCredits, shortHex } from "@/lib/format";
import { availableActions, type AgreementView, type MilestoneView, type Role } from "@/lib/actions";
import { matchesHash, termsSchema, type Terms } from "@/lib/terms";
import { EvidenceViewer } from "@/features/milestone/EvidenceViewer";
import { FreelancerSubmissionPanel } from "@/features/milestone/FreelancerSubmissionPanel";
import { BuyerReviewPanel } from "@/features/milestone/BuyerReviewPanel";
import { ResolverSettlementPanel } from "@/features/milestone/ResolverSettlementPanel";
import { AgreementHistory } from "@/features/milestone/AgreementHistory";
import { BuyerReviewBox } from "@/features/milestone/BuyerReviewBox";
import { InAgreementNegotiationBox } from "@/features/milestone/InAgreementNegotiationBox";
import { DisputePanel } from "@/features/milestone/DisputePanel";
import { PostCompletionTipModule } from "@/features/milestone/PostCompletionTipModule";
import { usePersona } from "@/lib/demo/persona-context";

// ---- raw chain types (viem returns structs as plain objects with named fields) ----

type RawAgreement = {
  buyer: Address;
  freelancer: Address;
  resolver: Address;
  reviewWindow: number;
  status: number;
  buyerApproved: boolean;
  freelancerApproved: boolean;
  milestoneCount: number;
  openMilestones: number;
  termsHash: `0x${string}`;
};

type RawMilestone = {
  credits: bigint;
  deadline: bigint;
  dueAt: bigint;
  submittedAt: bigint;
  revisionLimit: number;
  revisionsUsed: number;
  status: number;
  evidenceHash: `0x${string}`;
  paidToFreelancer: bigint;
  refundedToBuyer: bigint;
};

const AGREEMENT_STATUSES = ["Proposed", "Active", "Completed", "Cancelled"] as const;
const MILESTONE_STATUSES = [
  "Unfunded",
  "Funded",
  "Submitted",
  "RevisionRequested",
  "Disputed",
  "Accepted",
  "Resolved",
  "Refunded",
] as const;

function toAgreementView(raw: RawAgreement): AgreementView {
  return {
    buyer: raw.buyer,
    freelancer: raw.freelancer,
    resolver: raw.resolver,
    reviewWindow: raw.reviewWindow,
    status: AGREEMENT_STATUSES[raw.status] ?? "Proposed",
    buyerApproved: raw.buyerApproved,
    freelancerApproved: raw.freelancerApproved,
    milestoneCount: raw.milestoneCount,
    openMilestones: raw.openMilestones,
    termsHash: raw.termsHash,
  };
}

function toMilestoneView(raw: RawMilestone): MilestoneView {
  return {
    credits: raw.credits,
    deadline: raw.deadline,
    dueAt: raw.dueAt,
    submittedAt: raw.submittedAt,
    revisionLimit: raw.revisionLimit,
    revisionsUsed: raw.revisionsUsed,
    status: MILESTONE_STATUSES[raw.status] ?? "Unfunded",
    evidenceHash: raw.evidenceHash,
    paidToFreelancer: raw.paidToFreelancer,
    refundedToBuyer: raw.refundedToBuyer,
  };
}

// ---- payment state label (spec 3.5) ----

function paymentStateLabel(m: MilestoneView): string {
  switch (m.status) {
    case "Unfunded":
      return "Not funded";
    case "Funded":
    case "Submitted":
    case "RevisionRequested":
      return "Locked in escrow";
    case "Disputed":
      return "Locked: in dispute";
    case "Accepted":
      return "Released";
    case "Resolved":
      return "Settled";
    case "Refunded":
      return "Refunded";
  }
}

// ---- status marker (spec 8.4): 8px square, never color alone ----

function StatusMarker({ status }: { status: MilestoneView["status"] }) {
  let cls = "";
  switch (status) {
    case "Unfunded":
      cls = "border border-stone";
      break;
    case "Funded":
    case "Submitted":
    case "RevisionRequested":
      cls = "bg-lime-deep";
      break;
    case "Accepted":
    case "Resolved":
      cls = "bg-lime";
      break;
    case "Disputed":
      cls = "bg-danger";
      break;
    case "Refunded":
      cls = "bg-ink";
      break;
  }
  return <span aria-hidden className={`inline-block size-2 ${cls}`} />;
}

// ---- date / time helpers ----

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

function formatUnix(unix: bigint): string {
  if (unix === 0n) return "—";
  return new Date(Number(unix) * 1000).toLocaleString();
}

function formatCountdown(unix: bigint, now: bigint): string {
  const diff = unix - now;
  if (diff <= 0n) return "Passed";
  const s = Number(diff);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

// ---- terms verification hook ----

type VerifyState =
  | { state: "loading" }
  | { state: "verified"; terms: Terms }
  | { state: "mismatch" }
  | { state: "error"; message: string };

function useTermsVerification(termsHash: string | undefined): VerifyState {
  const [result, setResult] = useState<VerifyState>({ state: "loading" });

  useEffect(() => {
    if (!termsHash || termsHash === ZERO_HASH) {
      setResult({ state: "error", message: "No terms hash recorded." });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/blobs/${termsHash}`);
        if (!res.ok) {
          if (!cancelled) setResult({ state: "error", message: "Terms blob not found on server." });
          return;
        }
        const blob = (await res.json()) as { json: unknown };
        if (cancelled) return;
        if (!matchesHash(blob.json, termsHash)) {
          setResult({ state: "mismatch" });
          return;
        }
        const parsed = termsSchema.safeParse(blob.json);
        if (!parsed.success) {
          setResult({ state: "mismatch" });
          return;
        }
        setResult({ state: "verified", terms: parsed.data });
      } catch (err) {
        if (!cancelled) {
          setResult({
            state: "error",
            message: err instanceof Error ? err.message : "Failed to load terms.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [termsHash]);

  return result;
}

// ---- main page component ----

export default function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const [agreementId, setAgreementId] = useState<bigint | undefined>();
  const { address } = usePersona();

  useEffect(() => {
    void params.then(({ id }) => {
      const n = parseInt(id, 10);
      if (Number.isFinite(n) && n > 0) setAgreementId(BigInt(n));
    });
  }, [params]);

  const { data: rawAgreement, isLoading: agreementLoading } = useAgreement(agreementId);
  const { data: rawMilestones, isLoading: milestonesLoading } = useMilestones(agreementId);
  const { data: availableCredits } = useAvailableOf(address);
  const tx = useLedgerWrite();

  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const [escalatingMilestoneIndex, setEscalatingMilestoneIndex] = useState<number | null>(null);

  // Keep now fresh every 30 seconds
  useEffect(() => {
    const timer = window.setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Listen to dev time travel event to immediately update countdowns and action availability
  useEffect(() => {
    function handleTimeAdvanced(e: Event) {
      const detail = (e as CustomEvent<{ seconds: number }>).detail;
      if (detail?.seconds) {
        setNow((prev) => prev + BigInt(detail.seconds));
      }
    }
    window.addEventListener("dev-time-advanced", handleTimeAdvanced);
    return () => window.removeEventListener("dev-time-advanced", handleTimeAdvanced);
  }, []);

  // Cast raw chain data (viem returns named-field objects matching our RawAgreement shape)
  const agreement = rawAgreement
    ? toAgreementView(rawAgreement as unknown as RawAgreement)
    : undefined;
  const milestones = rawMilestones
    ? (rawMilestones as unknown as RawMilestone[]).map(toMilestoneView)
    : undefined;

  const termsVerify = useTermsVerification(agreement?.termsHash);

  // Determine the connected wallet's role in this agreement
  const role: Role = (() => {
    if (!address || !agreement) return "viewer";
    const addr = address.toLowerCase();
    if (addr === agreement.buyer.toLowerCase()) return "buyer";
    if (addr === agreement.freelancer.toLowerCase()) return "freelancer";
    if (addr === agreement.resolver.toLowerCase()) return "resolver";
    return "viewer";
  })();

  const credits = availableCredits ?? 0n;
  const hashBlocked = termsVerify.state === "mismatch" || termsVerify.state === "error";

  const isCompleted = agreement?.status === "Completed";
  const allSettledOrAccepted = Boolean(
    milestones &&
    milestones.length > 0 &&
    milestones.every((m) => m.status === "Accepted" || m.status === "Resolved"),
  );
  const hasAcceptedFinalMilestone = Boolean(
    milestones &&
    milestones.length > 0 &&
    (milestones[milestones.length - 1]?.status === "Accepted" ||
      milestones.every((m) => m.status === "Accepted" || m.status === "Resolved")),
  );
  const showTipModule = (isCompleted || hasAcceptedFinalMilestone) && role === "buyer";
  const showBuyerReview = isCompleted && allSettledOrAccepted && role === "buyer";

  async function handleApprove() {
    if (!agreementId) return;
    await tx.send("approve", [agreementId]);
  }

  async function handleCancel() {
    if (!agreementId) return;
    await tx.send("cancelProposal", [agreementId]);
  }

  async function handleFund(index: number) {
    if (!agreementId) return;
    await tx.send("fundMilestone", [agreementId, BigInt(index)]);
  }

  async function handleAccept(index: number) {
    if (!agreementId) return;
    await tx.send("acceptWork", [agreementId, BigInt(index)]);
  }

  async function handleClaimTimeout(index: number) {
    if (!agreementId) return;
    await tx.send("claimAfterReviewTimeout", [agreementId, BigInt(index)]);
  }

  async function handleReclaim(index: number) {
    if (!agreementId) return;
    await tx.send("reclaimMissedDeadline", [agreementId, BigInt(index)]);
  }

  // ---- early states ----

  if (!agreementId) {
    return <p className="text-muted-on-light">Invalid agreement ID.</p>;
  }

  if (agreementLoading || milestonesLoading) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl">
        <div className="flex animate-pulse flex-col gap-3">
          <div className="h-8 w-48 rounded bg-stone/20" />
          <div className="h-4 w-72 rounded bg-stone/20" />
        </div>
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse flex-col gap-4 rounded-card border border-stone-soft bg-canvas p-6"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 rounded bg-stone/20" />
                <div className="h-5 w-20 rounded bg-lime/20" />
              </div>
              <div className="h-4 w-full rounded bg-stone/20" />
              <div className="h-4 w-2/3 rounded bg-stone/20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!agreement || !milestones) {
    return (
      <div className="max-w-measure">
        <p className="text-danger">Agreement not found or contract not deployed.</p>
        <p className="mt-2 text-caption text-muted-on-light">
          Run <code className="font-mono">npm run deploy:local</code> then{" "}
          <code className="font-mono">npm run seed</code> to prepare the local chain.
        </p>
      </div>
    );
  }

  // ---- derived values ----

  const totalCredits = milestones.reduce((s, m) => s + m.credits, 0n);
  const releasedCredits = milestones.reduce(
    (s, m) => (m.status === "Accepted" || m.status === "Resolved" ? s + m.paidToFreelancer : s),
    0n,
  );
  const acceptedCount = milestones.filter(
    (m) => m.status === "Accepted" || m.status === "Resolved",
  ).length;

  const canApprove =
    agreement.status === "Proposed" &&
    ((role === "buyer" && !agreement.buyerApproved) ||
      (role === "freelancer" && !agreement.freelancerApproved));

  const canCancel = agreement.status === "Proposed" && (role === "buyer" || role === "freelancer");

  // Verification badge
  const verifyBadge = (() => {
    switch (termsVerify.state) {
      case "verified":
        return (
          <span className="rounded-tag border border-lime-deep px-2 text-caption text-lime-deep">
            Verified
          </span>
        );
      case "mismatch":
        return (
          <span className="rounded-tag border border-danger px-2 text-caption text-danger">
            Hash mismatch
          </span>
        );
      case "loading":
        return (
          <span className="rounded-tag border border-stone px-2 text-caption text-muted-on-light">
            Verifying…
          </span>
        );
      case "error":
        return (
          <span className="rounded-tag border border-warning px-2 text-caption text-warning">
            {termsVerify.message}
          </span>
        );
    }
  })();

  // ---- render ----

  const pageTitle =
    termsVerify.state === "verified"
      ? termsVerify.terms.title
      : `Agreement #${agreementId.toString()}`;

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      {/* Header */}
      <div className="max-w-measure">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title">{pageTitle}</h1>
          {verifyBadge}
        </div>
        {termsVerify.state === "verified" && termsVerify.terms.description && (
          <p className="mt-3 text-muted-on-light">{termsVerify.terms.description}</p>
        )}
        {hashBlocked && (
          <div
            role="alert"
            className="mt-4 border border-danger px-4 py-3 text-caption text-danger"
          >
            <strong>Warning:</strong> The stored terms do not match the on-chain hash. Approve and
            Fund are disabled until this is resolved.
          </div>
        )}
      </div>

      {/* Parties */}
      <section aria-labelledby="parties-heading" className="flex flex-col gap-4">
        <h2 id="parties-heading" className="text-lead font-medium">
          Parties
        </h2>
        <dl className="grid grid-cols-1 gap-4 text-caption sm:grid-cols-2">
          {(
            [
              ["Buyer", agreement.buyer, agreement.buyerApproved, role === "buyer"],
              [
                "Freelancer",
                agreement.freelancer,
                agreement.freelancerApproved,
                role === "freelancer",
              ],
            ] as [string, string, boolean, boolean][]
          ).map(([label, addr, approved, isYou]) => (
            <div key={label}>
              <dt className="text-muted-on-light">{label}</dt>
              <dd className="flex items-center gap-2 font-mono">
                {shortHex(addr)}
                <CopyButton value={addr} label={`Copy ${label.toLowerCase()} address`} />
                {isYou && <span className="text-muted-on-light font-sans">(you)</span>}
              </dd>
              <dd className="mt-1 font-sans">
                {approved ? (
                  <span className="text-lime-deep">Approved</span>
                ) : (
                  <span className="text-muted-on-light">Pending approval</span>
                )}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-muted-on-light">Resolver</dt>
            <dd className="flex items-center gap-2 font-mono">
              {shortHex(agreement.resolver)}
              <CopyButton value={agreement.resolver} label="Copy resolver address" />
              {role === "resolver" && <span className="text-muted-on-light font-sans">(you)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-muted-on-light">Status</dt>
            <dd className="font-medium font-sans">{agreement.status}</dd>
          </div>
          <div>
            <dt className="text-muted-on-light">Review window</dt>
            <dd className="font-sans">{(agreement.reviewWindow / 3600).toFixed(0)} hours</dd>
          </div>
          <div>
            <dt className="text-muted-on-light">Terms hash</dt>
            <dd className="flex items-center gap-2 font-mono">
              {shortHex(agreement.termsHash)}
              <CopyButton value={agreement.termsHash} label="Copy terms hash" />
            </dd>
          </div>
        </dl>
      </section>

      {/* Agreement-level actions: Approve / Cancel */}
      {(canApprove || canCancel) && (
        <section aria-labelledby="approval-heading" className="flex flex-col gap-3">
          <h2 id="approval-heading" className="text-lead font-medium">
            Your response
          </h2>
          {hashBlocked && (
            <p className="text-caption text-danger">
              Hash mismatch — Approve is disabled until the stored terms match the on-chain hash.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {canApprove && (
              <button
                type="button"
                className="btn-primary"
                disabled={tx.disabled || hashBlocked}
                onClick={() => void handleApprove()}
              >
                {tx.disabled &&
                (tx.state.status === "awaitingWallet" || tx.state.status === "pending") ? (
                  <>
                    <Spinner className="mr-2 size-4 animate-spin text-ink" />
                    Approving…
                  </>
                ) : (
                  "Approve agreement"
                )}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="btn-destructive"
                disabled={tx.disabled}
                onClick={() => void handleCancel()}
              >
                Cancel proposal
              </button>
            )}
          </div>
          <TxStatus state={tx.state} />
        </section>
      )}

      {/* Milestone timeline */}
      <section aria-labelledby="milestones-heading" className="flex flex-col gap-4">
        <h2 id="milestones-heading" className="text-lead font-medium">
          Milestones
          <span className="ml-3 font-sans text-caption font-normal text-muted-on-light">
            {acceptedCount} of {milestones.length} accepted · {formatCredits(releasedCredits)} of{" "}
            {formatCredits(totalCredits)} released
          </span>
        </h2>

        <div className="flex flex-col gap-4">
          {milestones.map((m, i) => {
            const mActions = availableActions(role, agreement, m, i, milestones, now, credits);
            const fundAction = mActions.find((a) => a.id === "fund");
            const submitAction = mActions.find((a) => a.id === "submit" || a.id === "resubmit");
            const acceptAction = mActions.find((a) => a.id === "accept");
            const requestRevisionAction = mActions.find((a) => a.id === "requestRevision");
            const disputeAction = mActions.find((a) => a.id === "dispute");
            const claimTimeoutAction = mActions.find((a) => a.id === "claimTimeout");
            const reclaimAction = mActions.find((a) => a.id === "reclaim");

            const milestoneTitle =
              termsVerify.state === "verified" ? termsVerify.terms.milestones[i]?.title : undefined;

            const isSubmitted = m.status === "Submitted";
            const isFundedOrRevision = m.status === "Funded" || m.status === "RevisionRequested";
            const isDisputed = m.status === "Disputed";
            const isResolved = m.status === "Resolved";
            const isAccepted = m.status === "Accepted";
            const hasEvidence = m.evidenceHash && m.evidenceHash !== ZERO_HASH;

            return (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-card border border-stone-soft p-4"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <StatusMarker status={m.status} />
                    <span className="font-medium">
                      Milestone {i + 1}
                      {milestoneTitle && (
                        <span className="ml-2 font-normal text-muted-on-light">
                          · {milestoneTitle}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="rounded-tag border border-muted-on-light px-2 text-caption text-muted-on-light">
                    {m.status}
                  </span>
                </div>

                {/* Data grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-caption">
                  <div>
                    <span className="text-muted-on-light">Credits: </span>
                    <span className="font-medium">{formatCredits(m.credits)}</span>
                  </div>
                  <div>
                    <span className="text-muted-on-light">Payment: </span>
                    <span className="font-medium">{paymentStateLabel(m)}</span>
                  </div>
                  <div>
                    <span className="text-muted-on-light">Deadline: </span>
                    <span>{formatUnix(m.deadline)}</span>
                  </div>
                  {isFundedOrRevision && (
                    <div>
                      <span className="text-muted-on-light">Due in: </span>
                      <span>{formatCountdown(m.dueAt, now)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-on-light">Revisions used: </span>
                    <span className="font-medium">
                      {m.revisionsUsed} / {m.revisionLimit}
                    </span>
                  </div>
                  {(isAccepted || isResolved) && (
                    <div>
                      <span className="text-muted-on-light">Released: </span>
                      <span className="font-medium">{formatCredits(m.paidToFreelancer)}</span>
                    </div>
                  )}
                  {(m.status === "Refunded" || isResolved) && (
                    <div>
                      <span className="text-muted-on-light">Refunded: </span>
                      <span className="font-medium">{formatCredits(m.refundedToBuyer)}</span>
                    </div>
                  )}
                  {hasEvidence && (
                    <div className="col-span-2">
                      <span className="text-muted-on-light">Evidence hash: </span>
                      <span className="font-mono">{shortHex(m.evidenceHash)}</span>{" "}
                      <CopyButton value={m.evidenceHash} label="Copy evidence hash" />
                    </div>
                  )}
                </div>

                {/* Display evidence viewer if evidence exists and buyer is not currently in review mode */}
                {hasEvidence && !(role === "buyer" && isSubmitted) && (
                  <div className="mt-2 pt-2 border-t border-stone-soft">
                    <EvidenceViewer evidenceHash={m.evidenceHash as Hex} />
                  </div>
                )}

                {/* Fund action (Buyer) */}
                {fundAction && (
                  <div className="mt-2 flex flex-col gap-2 border-t border-stone-soft pt-3">
                    <button
                      type="button"
                      className="btn-primary self-start"
                      disabled={!fundAction.available || tx.disabled || hashBlocked}
                      onClick={() => void handleFund(i)}
                    >
                      {tx.disabled &&
                      (tx.state.status === "awaitingWallet" || tx.state.status === "pending") ? (
                        <>
                          <Spinner className="mr-2 size-4 animate-spin text-ink" />
                          Funding milestone {i + 1}…
                        </>
                      ) : (
                        `Fund milestone ${i + 1}: lock ${m.credits.toLocaleString()} credits`
                      )}
                    </button>
                    {!fundAction.available && (
                      <p className="text-caption text-muted-on-light">
                        {fundAction.disabledReason}
                      </p>
                    )}
                    <p className="text-caption text-muted-on-light">
                      @ 2026 Fairwork. Flower Incorporerated.
                    </p>
                    {hashBlocked && (
                      <p className="text-caption text-danger">
                        Fund is disabled until terms are verified.
                      </p>
                    )}
                  </div>
                )}

                {/* Buyer Reclaim Missed Deadline action */}
                {role === "buyer" && isFundedOrRevision && reclaimAction && (
                  <div className="mt-2 flex flex-col gap-2 border-t border-stone-soft pt-2">
                    {reclaimAction.available ? (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="btn-secondary self-start border-danger text-danger text-caption"
                          disabled={tx.disabled}
                          onClick={() => void handleReclaim(i)}
                        >
                          Reclaim credits: refund {m.credits.toLocaleString()} credits
                        </button>
                        <p className="text-[0.75rem] text-muted-on-light">
                          Freelancer deadline has passed without delivery. You can reclaim the
                          locked credits.
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Freelancer Submission Panel (Funded or RevisionRequested) */}
                {role === "freelancer" && isFundedOrRevision && (
                  <div className="mt-2 border-t border-stone-soft pt-2">
                    {submitAction && !submitAction.available ? (
                      <p className="text-caption text-danger">
                        Submission unavailable: {submitAction.disabledReason}
                      </p>
                    ) : (
                      <FreelancerSubmissionPanel
                        agreementId={agreementId}
                        milestoneIndex={i}
                        isRevision={m.status === "RevisionRequested"}
                        canDispute={disputeAction?.available ?? false}
                        disputeDisabledReason={
                          disputeAction && !disputeAction.available
                            ? disputeAction.disabledReason
                            : undefined
                        }
                      />
                    )}
                  </div>
                )}

                {/* Buyer Review Panel (Submitted) */}
                {role === "buyer" && isSubmitted && hasEvidence && (
                  <div className="mt-2 border-t border-stone-soft pt-2">
                    <BuyerReviewPanel
                      agreementId={agreementId}
                      milestoneIndex={i}
                      evidenceHash={m.evidenceHash as Hex}
                      canAccept={acceptAction?.available ?? false}
                      canRequestRevision={requestRevisionAction?.available ?? false}
                      revisionDisabledReason={
                        requestRevisionAction && !requestRevisionAction.available
                          ? requestRevisionAction.disabledReason
                          : undefined
                      }
                      canDispute={disputeAction?.available ?? false}
                      disputeDisabledReason={
                        disputeAction && !disputeAction.available
                          ? disputeAction.disabledReason
                          : undefined
                      }
                      revisionsUsed={m.revisionsUsed}
                      revisionLimit={m.revisionLimit}
                    />
                  </div>
                )}

                {/* Freelancer Claim on Review Timeout (Submitted) */}
                {role === "freelancer" && isSubmitted && claimTimeoutAction && (
                  <div className="mt-2 flex flex-col gap-2 border-t border-stone-soft pt-2">
                    {claimTimeoutAction.available ? (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="btn-primary self-start text-caption"
                          disabled={tx.disabled}
                          onClick={() => void handleClaimTimeout(i)}
                        >
                          Claim payment: release {m.credits.toLocaleString()} credits
                        </button>
                        <p className="text-[0.75rem] text-muted-on-light">
                          Buyer review window has expired without action. You may claim your
                          payment.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[0.8rem] text-muted-on-light">
                        Review window is active ({claimTimeoutAction.disabledReason}). If buyer
                        remains silent past the review window, you can claim the full payment.
                      </p>
                    )}
                  </div>
                )}

                {/* In-Agreement Negotiation & Issue Discussion Box (Stage 1 & Escalation Trigger) */}
                {(isSubmitted || m.status === "RevisionRequested" || isDisputed) && (
                  <InAgreementNegotiationBox
                    agreementId={agreementId}
                    milestoneIndex={i}
                    role={role}
                    senderAddress={address}
                    status={m.status}
                    canSettleAmicably={
                      role === "buyer" && (isSubmitted || m.status === "RevisionRequested")
                    }
                    canEscalate={disputeAction?.available ?? false}
                    onSettleAmicably={() => void handleAccept(i)}
                    onEscalateToSupport={() => setEscalatingMilestoneIndex(i)}
                    isSettling={
                      tx.state.status === "awaitingWallet" || tx.state.status === "pending"
                    }
                  />
                )}

                {/* Formal Dispute Escalation Modal (Stage 2) */}
                {escalatingMilestoneIndex === i && (
                  <DisputePanel
                    agreementId={agreementId}
                    milestoneIndex={i}
                    role={role === "freelancer" ? "freelancer" : "buyer"}
                    canDispute={disputeAction?.available ?? false}
                    disabledReason={
                      disputeAction && !disputeAction.available
                        ? disputeAction.disabledReason
                        : undefined
                    }
                    isOpenControlled={true}
                    onCloseControlled={() => setEscalatingMilestoneIndex(null)}
                  />
                )}

                {/* Disputed Status Callout & Fairwork Support Resolution Desk (Stage 3) */}
                {isDisputed && (
                  <div className="mt-2 border-t border-stone-soft pt-2 flex flex-col gap-3">
                    <div className="rounded-tag border border-danger/40 bg-canvas p-3 text-caption">
                      <div className="flex items-center gap-2 font-medium text-danger">
                        <span aria-hidden className="inline-block size-2 bg-danger" />
                        <span>Locked: In Dispute</span>
                      </div>
                      <p className="mt-1 text-muted-on-light">
                        This milestone is disputed. All standard actions are locked. The designated
                        resolver (<span className="font-mono">{shortHex(agreement.resolver)}</span>)
                        must settle the dispute to allocate or refund the credits.
                      </p>
                    </div>

                    {role === "resolver" && (
                      <ResolverSettlementPanel
                        agreementId={agreementId}
                        milestoneIndex={i}
                        credits={m.credits}
                        milestoneTitle={
                          termsVerify.state === "verified"
                            ? termsVerify.terms.milestones[i]?.title
                            : undefined
                        }
                        acceptanceCriteria={
                          termsVerify.state === "verified"
                            ? termsVerify.terms.milestones[i]?.acceptanceCriteria
                            : []
                        }
                        deliverables={
                          termsVerify.state === "verified"
                            ? termsVerify.terms.milestones[i]?.deliverables
                            : []
                        }
                        evidenceHash={m.evidenceHash}
                      />
                    )}
                  </div>
                )}

                {/* Resolved Status Notification */}
                {isResolved && (
                  <div className="mt-2 border-t border-stone-soft pt-2">
                    <p className="text-[0.8rem] text-lime-deep">
                      ✓ Dispute resolved by resolver. {m.paidToFreelancer.toLocaleString()} credits
                      released to freelancer, {m.refundedToBuyer.toLocaleString()} credits refunded
                      to buyer.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tx status for agreement-level actions (fund/cancel/timeout/reclaim) */}
        {tx.state.status !== "idle" && !canApprove && !canCancel && <TxStatus state={tx.state} />}
      </section>

      {/* Post-Completion Tip Module (when final milestone accepted or agreement completed) */}
      {showTipModule && agreement && (
        <PostCompletionTipModule
          agreementId={agreementId}
          buyerAddress={agreement.buyer}
          freelancerAddress={agreement.freelancer}
        />
      )}

      {/* Buyer Review Section (when completed and all milestones accepted/settled) */}
      {showBuyerReview && agreement && (
        <BuyerReviewBox
          agreementId={agreementId}
          freelancerAddress={agreement.freelancer}
          buyerAddress={agreement.buyer}
        />
      )}

      {/* Your balance */}
      {address && (
        <section aria-labelledby="balance-heading" className="flex flex-col gap-2">
          <h2 id="balance-heading" className="text-lead font-medium">
            Your balance
          </h2>
          <p className="text-caption text-muted-on-light">
            Available:{" "}
            <span className="font-medium text-ink">
              {availableCredits !== undefined ? formatCredits(availableCredits) : "Loading…"}
            </span>
          </p>
          <p className="text-caption text-muted-on-light">
            @ 2026 Fairwork. Flower Incorporerated.
          </p>
        </section>
      )}

      {/* Terms details (when verified) */}
      {termsVerify.state === "verified" && (
        <section aria-labelledby="terms-heading" className="flex flex-col gap-4">
          <h2 id="terms-heading" className="text-lead font-medium">
            Terms (verified)
          </h2>
          {termsVerify.terms.milestones.map((m, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-card border border-stone-soft p-4 text-caption"
            >
              <p className="font-medium">
                Milestone {i + 1}: {m.title}
              </p>
              <div>
                <p className="text-muted-on-light">Deliverables:</p>
                <ul className="ml-4 list-disc">
                  {m.deliverables.map((d, di) => (
                    <li key={di}>{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-on-light">Acceptance criteria:</p>
                <ul className="ml-4 list-disc">
                  {m.acceptanceCriteria.map((c, ci) => (
                    <li key={ci}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* On-Chain Transaction & Event History */}
      <AgreementHistory agreementId={agreementId} />
    </div>
  );
}
