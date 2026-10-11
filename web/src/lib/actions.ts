/**
 * availableActions: pure function mirroring the contract state machine (spec 8.2).
 * No React, no wagmi, no chain calls. Unit-tested in web/tests/.
 */

// ---- enums (mirror the Solidity enums) ----

export type AgreementStatus = "Proposed" | "Active" | "Completed" | "Cancelled";
export type MilestoneStatus =
  | "Unfunded"
  | "Funded"
  | "Submitted"
  | "RevisionRequested"
  | "Disputed"
  | "Accepted"
  | "Resolved"
  | "Refunded";

export type Role = "buyer" | "freelancer" | "resolver" | "viewer";

// ---- data shapes (match chain return types; credits are bigint) ----

export type AgreementView = {
  buyer: string;
  freelancer: string;
  resolver: string;
  reviewWindow: number; // seconds
  status: AgreementStatus;
  buyerApproved: boolean;
  freelancerApproved: boolean;
  milestoneCount: number;
  openMilestones: number;
  termsHash: string;
};

export type MilestoneView = {
  credits: bigint;
  deadline: bigint; // unix seconds
  dueAt: bigint; // unix seconds
  submittedAt: bigint; // 0 if never submitted
  revisionLimit: number;
  revisionsUsed: number;
  status: MilestoneStatus;
  evidenceHash: string;
  paidToFreelancer: bigint;
  refundedToBuyer: bigint;
};

// ---- action identifiers ----

export type ActionId =
  | "approve"
  | "cancelProposal"
  | "fund"
  | "submit"
  | "accept"
  | "requestRevision"
  | "dispute"
  | "resubmit"
  | "claimTimeout"
  | "reclaim"
  | "settle";

export type Action =
  { id: ActionId; available: true } | { id: ActionId; available: false; disabledReason: string };

// ---- helpers ----

function isTerminal(status: MilestoneStatus): boolean {
  return status === "Accepted" || status === "Resolved" || status === "Refunded";
}

function allPreviousTerminal(milestones: MilestoneView[], index: number): boolean {
  for (let i = 0; i < index; i++) {
    if (!isTerminal(milestones[i].status)) return false;
  }
  return true;
}

function secondsToHuman(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0 && h > 0) return `${d}d ${h}h`;
  if (d > 0) return `${d}d`;
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ---- main export ----

/**
 * Returns the set of actions for a single milestone, based on the caller's role and current time.
 * The contract is the source of truth; this function only mirrors it for the UI.
 *
 * @param role          The connected wallet's role in this agreement.
 * @param agreement     The on-chain agreement fields.
 * @param milestone     The on-chain milestone fields.
 * @param milestoneIndex The 0-based index of this milestone in the agreement.
 * @param allMilestones  All milestones for the agreement (to enforce sequential ordering for fund).
 * @param nowSeconds    Current unix timestamp in seconds.
 * @param availableCredits The caller's current available balance.
 */
export function availableActions(
  role: Role,
  agreement: AgreementView,
  milestone: MilestoneView,
  milestoneIndex: number,
  allMilestones: MilestoneView[],
  nowSeconds: bigint,
  availableCredits: bigint,
): Action[] {
  const actions: Action[] = [];
  const { status } = milestone;
  const now = nowSeconds;

  // Agreement-level actions (not milestone-specific)
  if (agreement.status === "Proposed") {
    if (role === "buyer" && !agreement.buyerApproved) {
      actions.push({ id: "approve", available: true });
    }
    if (role === "freelancer" && !agreement.freelancerApproved) {
      actions.push({ id: "approve", available: true });
    }
    if (role === "buyer" || role === "freelancer") {
      actions.push({ id: "cancelProposal", available: true });
    }
    return actions;
  }

  if (agreement.status !== "Active") {
    // Completed or Cancelled: no actions
    return [];
  }

  // Milestone-level actions
  if (status === "Unfunded") {
    if (role === "buyer") {
      const prevTerminal = allPreviousTerminal(allMilestones, milestoneIndex);
      if (!prevTerminal) {
        actions.push({
          id: "fund",
          available: false,
          disabledReason: "Previous milestones must be completed first",
        });
      } else if (now >= milestone.deadline) {
        actions.push({
          id: "fund",
          available: false,
          disabledReason: "Milestone deadline has passed",
        });
      } else if (availableCredits < milestone.credits) {
        actions.push({
          id: "fund",
          available: false,
          disabledReason: `Needs ${milestone.credits.toLocaleString()} credits, you have ${availableCredits.toLocaleString()}`,
        });
      } else {
        actions.push({ id: "fund", available: true });
      }
    }
    return actions;
  }

  if (status === "Funded") {
    if (role === "buyer") {
      if (now > milestone.dueAt) {
        actions.push({ id: "reclaim", available: true });
      } else {
        actions.push({
          id: "reclaim",
          available: false,
          disabledReason: `Deadline in ${secondsToHuman(Number(milestone.dueAt - now))}`,
        });
      }
    }
    if (role === "freelancer") {
      if (now <= milestone.dueAt) {
        actions.push({ id: "submit", available: true });
      } else {
        actions.push({
          id: "submit",
          available: false,
          disabledReason: "Deadline has passed",
        });
      }
    }
    return actions;
  }

  if (status === "Submitted") {
    const reviewDeadline = milestone.submittedAt + BigInt(agreement.reviewWindow);
    const insideWindow = now <= reviewDeadline;

    if (role === "buyer") {
      // Accept is always available
      actions.push({ id: "accept", available: true });

      // Request revision: inside window, revisions remaining
      if (insideWindow && milestone.revisionsUsed < milestone.revisionLimit) {
        actions.push({ id: "requestRevision", available: true });
      } else if (!insideWindow) {
        actions.push({
          id: "requestRevision",
          available: false,
          disabledReason: "Review window has closed",
        });
      } else {
        actions.push({
          id: "requestRevision",
          available: false,
          disabledReason: "Revision limit reached: accept or dispute",
        });
      }

      // Dispute: inside window only
      if (insideWindow) {
        actions.push({ id: "dispute", available: true });
      } else {
        actions.push({
          id: "dispute",
          available: false,
          disabledReason: "Review window has closed",
        });
      }
    }

    if (role === "freelancer") {
      if (!insideWindow) {
        actions.push({ id: "claimTimeout", available: true });
      } else {
        actions.push({
          id: "claimTimeout",
          available: false,
          disabledReason: `Review window ends in ${secondsToHuman(Number(reviewDeadline - now))}`,
        });
      }
    }
    return actions;
  }

  if (status === "RevisionRequested") {
    if (role === "buyer") {
      if (now > milestone.dueAt) {
        actions.push({ id: "reclaim", available: true });
      } else {
        actions.push({
          id: "reclaim",
          available: false,
          disabledReason: `Revision deadline in ${secondsToHuman(Number(milestone.dueAt - now))}`,
        });
      }
    }
    if (role === "freelancer") {
      if (now <= milestone.dueAt) {
        actions.push({ id: "resubmit", available: true });
      } else {
        actions.push({
          id: "resubmit",
          available: false,
          disabledReason: "Revision deadline has passed",
        });
      }
      // Freelancer can dispute a revision request
      actions.push({ id: "dispute", available: true });
    }
    return actions;
  }

  if (status === "Disputed") {
    if (role === "resolver") {
      actions.push({ id: "settle", available: true });
    }
    // buyer and freelancer: locked, no actions
    return actions;
  }

  // Terminal states: Accepted, Resolved, Refunded — no actions
  return actions;
}
