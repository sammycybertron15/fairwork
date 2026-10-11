/**
 * selectors.ts: Pure helper functions to aggregate dashboard metrics,
 * milestones progress, deadlines, and disputes (spec 8.1, 8.4).
 * No React, no wagmi, unit-tested in web/tests/selectors.test.ts.
 */

import type { AgreementView, MilestoneView } from "./actions";

export type AgreementWithMilestones = {
  id: bigint;
  agreement: AgreementView;
  milestones: MilestoneView[];
};

export type DashboardMetrics = {
  availableCredits: bigint;
  lockedCredits: bigint;
  releasedCredits: bigint;
  refundedCredits: bigint;
};

export type AgreementProgress = {
  acceptedMilestones: number;
  totalMilestones: number;
  releasedCredits: bigint;
  totalCredits: bigint;
  summary: string;
};

export type ActiveDisputeItem = {
  agreementId: bigint;
  milestoneIndex: number;
  milestoneCredits: bigint;
  counterpartyAddress: string;
  termsHash: string;
};

export type NextDeadlineItem = {
  agreementId: bigint;
  milestoneIndex: number;
  dueAt: bigint;
  status: MilestoneView["status"];
  counterpartyAddress: string;
};

/**
 * Filter agreements where the connected wallet participates in the chosen role.
 */
export function filterAgreementsByRole(
  agreements: AgreementWithMilestones[],
  account: string | undefined,
  role: "buyer" | "freelancer",
): AgreementWithMilestones[] {
  if (!account) return [];
  const normalized = account.toLowerCase();
  return agreements.filter((item) => {
    if (role === "buyer") {
      return item.agreement.buyer.toLowerCase() === normalized;
    }
    return item.agreement.freelancer.toLowerCase() === normalized;
  });
}

/**
 * Calculates milestone completion progress for an agreement.
 */
export function getAgreementProgress(milestones: MilestoneView[]): AgreementProgress {
  const totalMilestones = milestones.length;
  let acceptedMilestones = 0;
  let releasedCredits = 0n;
  let totalCredits = 0n;

  for (const m of milestones) {
    totalCredits += m.credits;
    if (m.status === "Accepted" || m.status === "Resolved") {
      acceptedMilestones++;
      releasedCredits += m.paidToFreelancer;
    }
  }

  return {
    acceptedMilestones,
    totalMilestones,
    releasedCredits,
    totalCredits,
    summary: `${acceptedMilestones} of ${totalMilestones} accepted`,
  };
}

/**
 * Aggregates financial totals for the dashboard metric row (spec 8.4):
 * - availableCredits: on-chain free credits outside escrow
 * - lockedCredits: credits currently locked in active milestone escrow
 * - releasedCredits: credits released to freelancer (paid)
 * - refundedCredits: credits refunded back to buyer
 */
export function calculateMetrics(
  role: "buyer" | "freelancer",
  availableCredits: bigint,
  agreements: AgreementWithMilestones[],
): DashboardMetrics {
  let lockedCredits = 0n;
  let releasedCredits = 0n;
  let refundedCredits = 0n;

  for (const item of agreements) {
    // Only count active or proposed agreements for locked escrow
    for (const m of item.milestones) {
      if (
        m.status === "Funded" ||
        m.status === "Submitted" ||
        m.status === "RevisionRequested" ||
        m.status === "Disputed"
      ) {
        lockedCredits += m.credits;
      }
      releasedCredits += m.paidToFreelancer;
      refundedCredits += m.refundedToBuyer;
    }
  }

  return {
    availableCredits,
    lockedCredits,
    releasedCredits,
    refundedCredits,
  };
}

/**
 * Finds all milestones across agreements currently in Disputed status.
 */
export function getActiveDisputes(
  agreements: AgreementWithMilestones[],
  role: "buyer" | "freelancer",
): ActiveDisputeItem[] {
  const disputes: ActiveDisputeItem[] = [];

  for (const item of agreements) {
    item.milestones.forEach((m, idx) => {
      if (m.status === "Disputed") {
        const counterpartyAddress =
          role === "buyer" ? item.agreement.freelancer : item.agreement.buyer;
        disputes.push({
          agreementId: item.id,
          milestoneIndex: idx,
          milestoneCredits: m.credits,
          counterpartyAddress,
          termsHash: item.agreement.termsHash,
        });
      }
    });
  }

  return disputes;
}

/**
 * Finds upcoming deadlines for active funded / revision milestones.
 */
export function getUpcomingDeadlines(
  agreements: AgreementWithMilestones[],
  role: "buyer" | "freelancer",
  nowSeconds: bigint = 0n,
): NextDeadlineItem[] {
  const items: NextDeadlineItem[] = [];

  for (const item of agreements) {
    item.milestones.forEach((m, idx) => {
      if ((m.status === "Funded" || m.status === "RevisionRequested") && m.dueAt > nowSeconds) {
        items.push({
          agreementId: item.id,
          milestoneIndex: idx,
          dueAt: m.dueAt,
          status: m.status,
          counterpartyAddress: role === "buyer" ? item.agreement.freelancer : item.agreement.buyer,
        });
      }
    });
  }

  return items.sort((a, b) => Number(a.dueAt - b.dueAt));
}
