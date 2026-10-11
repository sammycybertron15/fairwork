import { describe, expect, it } from "vitest";
import { availableActions, type AgreementView, type MilestoneView } from "../src/lib/actions";

const BASE_AGREEMENT: AgreementView = {
  buyer: "0x1111111111111111111111111111111111111111",
  freelancer: "0x2222222222222222222222222222222222222222",
  resolver: "0x3333333333333333333333333333333333333333",
  reviewWindow: 86400, // 1 day
  status: "Active",
  buyerApproved: true,
  freelancerApproved: true,
  milestoneCount: 1,
  openMilestones: 1,
  termsHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
};

const BASE_MILESTONE: MilestoneView = {
  credits: 500n,
  deadline: 1000000n,
  dueAt: 1000000n,
  submittedAt: 0n,
  revisionLimit: 2,
  revisionsUsed: 0,
  status: "Unfunded",
  evidenceHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  paidToFreelancer: 0n,
  refundedToBuyer: 0n,
};

describe("availableActions matrix (spec 8.2)", () => {
  it("Unfunded: buyer can fund if credits sufficient; disabled if insufficient", () => {
    const m = { ...BASE_MILESTONE, status: "Unfunded" as const };
    const now = 500000n;

    // Buyer with sufficient credits
    const buyerActions = availableActions("buyer", BASE_AGREEMENT, m, 0, [m], now, 1000n);
    expect(buyerActions).toEqual([{ id: "fund", available: true }]);

    // Buyer with insufficient credits
    const buyerActionsBroke = availableActions("buyer", BASE_AGREEMENT, m, 0, [m], now, 200n);
    expect(buyerActionsBroke[0].available).toBe(false);

    // Freelancer has no actions
    const freelancerActions = availableActions("freelancer", BASE_AGREEMENT, m, 0, [m], now, 1000n);
    expect(freelancerActions).toEqual([]);
  });

  it("Funded: freelancer can submit before dueAt; buyer can reclaim after dueAt", () => {
    const m = { ...BASE_MILESTONE, status: "Funded" as const, dueAt: 1000n };

    // Before deadline
    const freeBefore = availableActions("freelancer", BASE_AGREEMENT, m, 0, [m], 500n, 0n);
    expect(freeBefore).toEqual([{ id: "submit", available: true }]);

    const buyerBefore = availableActions("buyer", BASE_AGREEMENT, m, 0, [m], 500n, 1000n);
    expect(buyerBefore[0].available).toBe(false);

    // After deadline
    const freeAfter = availableActions("freelancer", BASE_AGREEMENT, m, 0, [m], 1500n, 0n);
    expect(freeAfter[0].available).toBe(false);

    const buyerAfter = availableActions("buyer", BASE_AGREEMENT, m, 0, [m], 1500n, 1000n);
    expect(buyerAfter).toEqual([{ id: "reclaim", available: true }]);
  });

  it("Submitted: buyer can accept, revise, or dispute inside window; freelancer can claim after window", () => {
    const submittedAt = 10000n;
    const window = 86400; // 1 day
    const m: MilestoneView = {
      ...BASE_MILESTONE,
      status: "Submitted",
      submittedAt: BigInt(submittedAt),
      revisionsUsed: 0,
      revisionLimit: 2,
    };
    const agreement = { ...BASE_AGREEMENT, reviewWindow: window };

    // Inside review window
    const nowInside = submittedAt + 1000n;
    const buyerInside = availableActions("buyer", agreement, m, 0, [m], nowInside, 0n);
    expect(buyerInside.map((a) => a.id)).toEqual(["accept", "requestRevision", "dispute"]);
    expect(buyerInside.every((a) => a.available)).toBe(true);

    const freeInside = availableActions("freelancer", agreement, m, 0, [m], nowInside, 0n);
    expect(freeInside[0].available).toBe(false);
    expect(freeInside[0].id).toBe("claimTimeout");

    // Outside review window
    const nowOutside = submittedAt + BigInt(window) + 100n;
    const buyerOutside = availableActions("buyer", agreement, m, 0, [m], nowOutside, 0n);
    expect(buyerOutside.find((a) => a.id === "accept")?.available).toBe(true);
    expect(buyerOutside.find((a) => a.id === "requestRevision")?.available).toBe(false);
    expect(buyerOutside.find((a) => a.id === "dispute")?.available).toBe(false);

    const freeOutside = availableActions("freelancer", agreement, m, 0, [m], nowOutside, 0n);
    expect(freeOutside).toEqual([{ id: "claimTimeout", available: true }]);
  });

  it("RevisionRequested: freelancer can resubmit or dispute; buyer can reclaim after dueAt", () => {
    const m: MilestoneView = {
      ...BASE_MILESTONE,
      status: "RevisionRequested",
      dueAt: 5000n,
      revisionsUsed: 1,
      revisionLimit: 2,
    };

    // Before dueAt
    const freeBefore = availableActions("freelancer", BASE_AGREEMENT, m, 0, [m], 2000n, 0n);
    expect(freeBefore.map((a) => a.id)).toEqual(["resubmit", "dispute"]);
    expect(freeBefore.every((a) => a.available)).toBe(true);

    const buyerBefore = availableActions("buyer", BASE_AGREEMENT, m, 0, [m], 2000n, 0n);
    expect(buyerBefore[0].available).toBe(false);

    // After dueAt
    const buyerAfter = availableActions("buyer", BASE_AGREEMENT, m, 0, [m], 6000n, 0n);
    expect(buyerAfter).toEqual([{ id: "reclaim", available: true }]);
  });

  it("Disputed: only resolver has settle action; buyer and freelancer have no actions", () => {
    const m: MilestoneView = {
      ...BASE_MILESTONE,
      status: "Disputed",
    };

    const resolverActions = availableActions("resolver", BASE_AGREEMENT, m, 0, [m], 1000n, 0n);
    expect(resolverActions).toEqual([{ id: "settle", available: true }]);

    const buyerActions = availableActions("buyer", BASE_AGREEMENT, m, 0, [m], 1000n, 0n);
    expect(buyerActions).toEqual([]);

    const freelancerActions = availableActions("freelancer", BASE_AGREEMENT, m, 0, [m], 1000n, 0n);
    expect(freelancerActions).toEqual([]);
  });

  it("Terminal states (Accepted, Resolved, Refunded): no actions for anyone", () => {
    for (const status of ["Accepted", "Resolved", "Refunded"] as const) {
      const m: MilestoneView = { ...BASE_MILESTONE, status };
      for (const role of ["buyer", "freelancer", "resolver", "viewer"] as const) {
        expect(availableActions(role, BASE_AGREEMENT, m, 0, [m], 1000n, 0n)).toEqual([]);
      }
    }
  });
});
