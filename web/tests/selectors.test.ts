import { describe, expect, it } from "vitest";
import type { AgreementView, MilestoneView } from "../src/lib/actions";
import {
  calculateMetrics,
  filterAgreementsByRole,
  getActiveDisputes,
  getAgreementProgress,
  getUpcomingDeadlines,
  type AgreementWithMilestones,
} from "../src/lib/selectors";

const BUYER = "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65";
const FREELANCER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const RESOLVER = "0xa0ee7a142d267c1f36714e4a8f75612f20a79720";

const AGREEMENT: AgreementView = {
  buyer: BUYER,
  freelancer: FREELANCER,
  resolver: RESOLVER,
  reviewWindow: 86400,
  status: "Active",
  buyerApproved: true,
  freelancerApproved: true,
  milestoneCount: 3,
  openMilestones: 2,
  termsHash: "0x1234",
};

const MILESTONES: MilestoneView[] = [
  {
    credits: 500n,
    deadline: 1000n,
    dueAt: 1000n,
    submittedAt: 500n,
    revisionLimit: 2,
    revisionsUsed: 0,
    status: "Accepted",
    evidenceHash: "0x1",
    paidToFreelancer: 500n,
    refundedToBuyer: 0n,
  },
  {
    credits: 700n,
    deadline: 2000n,
    dueAt: 2000n,
    submittedAt: 1200n,
    revisionLimit: 1,
    revisionsUsed: 0,
    status: "Disputed",
    evidenceHash: "0x2",
    paidToFreelancer: 0n,
    refundedToBuyer: 0n,
  },
  {
    credits: 300n,
    deadline: 3000n,
    dueAt: 0n,
    submittedAt: 0n,
    revisionLimit: 0,
    revisionsUsed: 0,
    status: "Unfunded",
    evidenceHash: "0x0",
    paidToFreelancer: 0n,
    refundedToBuyer: 0n,
  },
];

const ITEM: AgreementWithMilestones = {
  id: 1n,
  agreement: AGREEMENT,
  milestones: MILESTONES,
};

describe("selectors", () => {
  it("filters agreements by role correctly (case-insensitive)", () => {
    const list = [ITEM];
    expect(filterAgreementsByRole(list, BUYER.toUpperCase(), "buyer")).toHaveLength(1);
    expect(filterAgreementsByRole(list, BUYER, "freelancer")).toHaveLength(0);
    expect(filterAgreementsByRole(list, FREELANCER, "freelancer")).toHaveLength(1);
    expect(filterAgreementsByRole(list, undefined, "buyer")).toEqual([]);
  });

  it("calculates agreement milestone progress accurately", () => {
    const progress = getAgreementProgress(MILESTONES);
    expect(progress.acceptedMilestones).toBe(1);
    expect(progress.totalMilestones).toBe(3);
    expect(progress.releasedCredits).toBe(500n);
    expect(progress.totalCredits).toBe(1500n);
    expect(progress.summary).toBe("1 of 3 accepted");
  });

  it("calculates dashboard metrics across agreements", () => {
    const metrics = calculateMetrics("buyer", 5000n, [ITEM]);
    expect(metrics.availableCredits).toBe(5000n);
    expect(metrics.lockedCredits).toBe(700n); // 700 in dispute is locked escrow
    expect(metrics.releasedCredits).toBe(500n);
    expect(metrics.refundedCredits).toBe(0n);
  });

  it("identifies active disputes", () => {
    const disputes = getActiveDisputes([ITEM], "buyer");
    expect(disputes).toHaveLength(1);
    expect(disputes[0].agreementId).toBe(1n);
    expect(disputes[0].milestoneIndex).toBe(1);
    expect(disputes[0].milestoneCredits).toBe(700n);
    expect(disputes[0].counterpartyAddress).toBe(FREELANCER);
  });

  it("extracts and sorts upcoming deadlines", () => {
    const fundedMilestone: MilestoneView = {
      ...MILESTONES[2],
      status: "Funded",
      dueAt: 2500n,
    };
    const itemWithDue: AgreementWithMilestones = {
      id: 2n,
      agreement: AGREEMENT,
      milestones: [fundedMilestone],
    };

    const deadlines = getUpcomingDeadlines([itemWithDue], "buyer", 1000n);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].dueAt).toBe(2500n);
    expect(deadlines[0].status).toBe("Funded");
  });
});
