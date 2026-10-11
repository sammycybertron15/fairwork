import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { Abi, AbiFunction } from "viem";
import {
  AS,
  DAY,
  MS,
  TOTAL,
  WINDOW,
  actors,
  activeFixture,
  balances,
  deployFixture,
  expectFail,
  expectRevert,
  h,
  milestone,
  time,
} from "./helpers";

// Every state change goes through ctx.tx(), which re-checks conservation (T9 / I1, I3, I8).

describe("FairworkLedger", () => {
  describe("T1 setup and grant", () => {
    it("grants 6,000 credits to the demo buyer and nothing to anyone else", async () => {
      const { ledger, wallets, buyer } = await loadFixture(deployFixture);
      expect(await ledger.read.totalIssued()).to.equal(TOTAL);
      for (const w of wallets) {
        const expected = w.account.address === buyer.account.address ? TOTAL : 0n;
        expect(await ledger.read.availableOf([w.account.address])).to.equal(expected);
      }
    });

    it("rejects a zero demo buyer", async () => {
      const zero = "0x0000000000000000000000000000000000000000";
      await expectRevert(hre.viem.deployContract("FairworkLedger", [zero]), "InvalidInput");
    });

    it("reverts on plain ETH and keeps a zero balance", async () => {
      const { ledger, deployer, publicClient } = await loadFixture(deployFixture);
      await expectFail(deployer.sendTransaction({ to: ledger.address, value: 1n } as any));
      expect(await publicClient.getBalance({ address: ledger.address })).to.equal(0n);
    });

    it("exposes no payable function and no token or withdraw function", async () => {
      const { ledger } = await loadFixture(deployFixture);
      const abi: Abi = ledger.abi;
      const fns = abi.filter((e): e is AbiFunction => e.type === "function");
      expect(fns.filter((f) => f.stateMutability === "payable")).to.have.length(0);
      const names = fns.map((f) => f.name);
      // `approve(uint256 id)` is the agreement approval from the spec, not an ERC-20 allowance.
      for (const banned of [
        "transfer",
        "transferFrom",
        "allowance",
        "withdraw",
        "totalSupply",
        "balanceOf",
        "mint",
      ]) {
        expect(names).to.not.include(banned);
      }
      expect(abi.some((e) => e.type === "receive" || e.type === "fallback")).to.equal(false);
    });
  });

  describe("T2 propose / approve / cancel", () => {
    it("stores a valid proposal exactly and auto-approves the proposer", async () => {
      const { ledger, buyer, terms, freelancer, resolver } = await loadFixture(activeFixture);
      const a = await ledger.read.getAgreement([1n]);
      expect([
        a.buyer.toLowerCase(),
        a.freelancer.toLowerCase(),
        a.resolver.toLowerCase(),
      ]).to.deep.equal([
        buyer.account.address.toLowerCase(),
        freelancer.account.address.toLowerCase(),
        resolver.account.address.toLowerCase(),
      ]);
      expect(a.termsHash).to.equal(terms[3]);
      expect([a.reviewWindow, a.milestoneCount, a.openMilestones]).to.deep.equal([WINDOW, 3, 3]);
      const ms = await ledger.read.getMilestones([1n]);
      expect(ms.map((m) => [m.credits, m.revisionLimit, m.status])).to.deep.equal([
        [500n, 1, MS.Unfunded],
        [700n, 2, MS.Unfunded],
        [300n, 0, MS.Unfunded],
      ]);
      expect(ms.map((m) => m.dueAt)).to.deep.equal(ms.map((m) => m.deadline));
      expect(await ledger.read.agreementCount()).to.equal(1n);
    });

    it("lets the freelancer propose too; the buyer then approves", async () => {
      const ctx = await loadFixture(deployFixture);
      const { ledger, buyer, freelancer, resolver, tx, as } = ctx;
      const now = await time.latest();
      const inputs = [{ credits: 100n, deadline: BigInt(now + DAY), revisionLimit: 1 }];
      const args = [
        buyer.account.address,
        freelancer.account.address,
        resolver.account.address,
        h("t"),
        WINDOW,
        inputs,
      ] as const;
      await tx(ledger.write.propose(args, { account: freelancer.account }));
      const a = await ledger.read.getAgreement([1n]);
      expect([a.buyerApproved, a.freelancerApproved, a.status]).to.deep.equal([
        false,
        true,
        AS.Proposed,
      ]);
      await tx((await as(buyer)).write.approve([1n]));
      expect((await ledger.read.getAgreement([1n])).status).to.equal(AS.Active);
    });

    describe("invalid proposals revert", () => {
      const cases: [string, (b: Base) => Partial<Base>, string][] = [
        ["same buyer and freelancer", (b) => ({ freelancer: b.buyer }), "InvalidInput"],
        ["resolver is the buyer", (b) => ({ resolver: b.buyer }), "InvalidInput"],
        ["resolver is the freelancer", (b) => ({ resolver: b.freelancer }), "InvalidInput"],
        ["zero resolver", () => ({ resolver: ZERO }), "InvalidInput"],
        ["zero hash", () => ({ hash: ZERO_HASH }), "InvalidInput"],
        ["window under 1 hour", () => ({ window: 3599 }), "InvalidInput"],
        ["window over 30 days", () => ({ window: 30 * DAY + 1 }), "InvalidInput"],
        ["no milestones", () => ({ inputs: [] }), "InvalidInput"],
        [
          "six milestones",
          (b) => ({ inputs: [1, 2, 3, 4, 5, 6].map((n) => ms(b.now, n)) }),
          "InvalidInput",
        ],
        ["zero credits", (b) => ({ inputs: [{ ...ms(b.now, 1), credits: 0n }] }), "InvalidInput"],
        [
          "deadline in the past",
          (b) => ({ inputs: [{ ...ms(b.now, 1), deadline: BigInt(b.now - 1) }] }),
          "InvalidInput",
        ],
        [
          "deadlines not increasing",
          (b) => ({ inputs: [ms(b.now, 2), ms(b.now, 1)] }),
          "InvalidInput",
        ],
        ["equal deadlines", (b) => ({ inputs: [ms(b.now, 1), ms(b.now, 1)] }), "InvalidInput"],
        ["caller not a party", () => ({ caller: "stranger" }), "NotParty"],
      ];
      for (const [name, change, error] of cases) {
        it(name, async () => {
          const ctx = await loadFixture(deployFixture);
          const base = await baseProposal(ctx);
          const p = { ...base, ...change(base) };
          const caller = p.caller === "stranger" ? ctx.stranger : ctx.buyer;
          await expectRevert(
            ctx.ledger.write.propose(
              [p.buyer, p.freelancer, p.resolver, p.hash, p.window, p.inputs],
              { account: caller.account },
            ),
            error,
          );
        });
      }
    });

    it("only the counterparty approves, and both approvals make it Active", async () => {
      const { ledger, buyer, freelancer, stranger, resolver, as, tx, id } = await proposedFixture();
      await expectRevert((await as(buyer)).write.approve([id]), "InvalidStatus"); // proposer already in
      await expectRevert((await as(stranger)).write.approve([id]), "NotParty");
      await expectRevert((await as(resolver)).write.approve([id]), "NotParty");
      await tx((await as(freelancer)).write.approve([id]));
      const a = await ledger.read.getAgreement([id]);
      expect([a.buyerApproved, a.freelancerApproved, a.status]).to.deep.equal([
        true,
        true,
        AS.Active,
      ]);
    });

    it("cancels only while Proposed", async () => {
      const { ledger, buyer, freelancer, stranger, as, tx, id } = await proposedFixture();
      await expectRevert((await as(stranger)).write.cancelProposal([id]), "NotParty");
      await tx((await as(freelancer)).write.cancelProposal([id]));
      expect((await ledger.read.getAgreement([id])).status).to.equal(AS.Cancelled);
      await expectRevert((await as(buyer)).write.cancelProposal([id]), "InvalidStatus");
      await expectRevert((await as(freelancer)).write.approve([id]), "InvalidStatus");
    });

    it("cannot cancel an Active agreement", async () => {
      const ctx = await loadFixture(activeFixture);
      await expectRevert((await ctx.as(ctx.buyer)).write.cancelProposal([1n]), "InvalidStatus");
    });
  });

  describe("T3 fund (escrow)", () => {
    it("locks exactly the milestone credits", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      expect((await balances(ctx)).buyer).to.equal(5500n);
      expect((await milestone(ctx, 0)).status).to.equal(MS.Funded);
      expect((await ctx.checkConservation()).escrow).to.equal(500n);
    });

    it("is buyer only, sequential and one-shot", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await expectRevert(a.freelancer.write.fundMilestone([1n, 0n]), "NotBuyer");
      await expectRevert(a.buyer.write.fundMilestone([1n, 1n]), "OutOfOrder");
      await expectRevert(a.buyer.write.fundMilestone([1n, 3n]), "InvalidInput");
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await expectRevert(a.buyer.write.fundMilestone([1n, 0n]), "InvalidStatus");
    });

    it("needs an Active agreement", async () => {
      const { buyer, as, id } = await proposedFixture();
      await expectRevert((await as(buyer)).write.fundMilestone([id, 0n]), "InvalidStatus");
    });

    it("reverts at or after the deadline", async () => {
      const ctx = await loadFixture(activeFixture);
      await time.increaseTo(ctx.deadlines[0]);
      await expectRevert((await ctx.as(ctx.buyer)).write.fundMilestone([1n, 0n]), "DeadlinePassed");
    });

    it("reverts when the buyer lacks credits", async () => {
      const ctx = await loadFixture(deployFixture);
      const base = await baseProposal(ctx);
      const big = [{ ...ms(base.now, 1), credits: TOTAL + 1n }];
      await ctx.tx(
        ctx.ledger.write.propose(
          [base.buyer, base.freelancer, base.resolver, base.hash, base.window, big],
          { account: ctx.buyer.account },
        ),
      );
      await ctx.tx((await ctx.as(ctx.freelancer)).write.approve([1n]));
      await expectRevert(
        (await ctx.as(ctx.buyer)).write.fundMilestone([1n, 0n]),
        "InsufficientCredits",
      );
    });
  });

  describe("T4 golden path", () => {
    it("fund, submit, revise, resubmit, accept", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v1")]));
      let m = await milestone(ctx, 0);
      expect([m.status, m.evidenceHash]).to.deep.equal([MS.Submitted, h("v1")]);
      expect(m.submittedAt > 0n).to.equal(true);

      await ctx.tx(a.buyer.write.requestRevision([1n, 0n, h("why")]));
      m = await milestone(ctx, 0);
      expect([m.status, m.revisionsUsed]).to.deep.equal([MS.RevisionRequested, 1]);
      expect(m.dueAt).to.equal(BigInt(await time.latest()) + BigInt(WINDOW));

      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v2")]));
      await ctx.tx(a.buyer.write.acceptWork([1n, 0n]));
      m = await milestone(ctx, 0);
      expect([m.status, m.paidToFreelancer, m.refundedToBuyer]).to.deep.equal([
        MS.Accepted,
        500n,
        0n,
      ]);
      expect(await balances(ctx)).to.deep.equal({ buyer: 5500n, freelancer: 500n });
      expect((await ctx.checkConservation()).escrow).to.equal(0n);
    });

    it("cannot be accepted twice", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await runToAccept(ctx, 0);
      await expectRevert(a.buyer.write.acceptWork([1n, 0n]), "InvalidStatus");
      expect((await balances(ctx)).freelancer).to.equal(500n);
    });

    it("enforces the revision limit", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v1")]));
      await ctx.tx(a.buyer.write.requestRevision([1n, 0n, h("r1")])); // limit is 1
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v2")]));
      await expectRevert(a.buyer.write.requestRevision([1n, 0n, h("r2")]), "RevisionLimitReached");
    });

    it("completes the agreement after the last milestone", async () => {
      const ctx = await loadFixture(activeFixture);
      for (const i of [0, 1, 2]) await runToAccept(ctx, i);
      const ag = await ctx.ledger.read.getAgreement([1n]);
      expect([ag.status, ag.openMilestones]).to.deep.equal([AS.Completed, 0]);
      expect(await balances(ctx)).to.deep.equal({ buyer: 4500n, freelancer: 1500n });
    });
  });

  describe("T5 timeouts and refunds", () => {
    it("freelancer claim: blocked inside the window, allowed after, paid once", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v1")]));
      await expectRevert(a.freelancer.write.claimAfterReviewTimeout([1n, 0n]), "WindowOpen");
      await time.increase(WINDOW + 1);
      await ctx.tx(a.freelancer.write.claimAfterReviewTimeout([1n, 0n]));
      expect(await balances(ctx)).to.deep.equal({ buyer: 5500n, freelancer: 500n });
      for (const again of [
        () => a.freelancer.write.claimAfterReviewTimeout([1n, 0n]),
        () => a.buyer.write.acceptWork([1n, 0n]),
        () => a.buyer.write.reclaimMissedDeadline([1n, 0n]),
      ])
        await expectRevert(again(), "InvalidStatus");
      const [ev] = await ctx.publicClient.getContractEvents({
        address: ctx.ledger.address,
        abi: ctx.ledger.abi,
        eventName: "MilestoneAccepted",
        fromBlock: 0n,
      });
      expect((ev as any).args.isAuto).to.equal(true);
    });

    it("buyer reclaim: blocked before dueAt, allowed after, paid once", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await expectRevert(a.buyer.write.reclaimMissedDeadline([1n, 0n]), "WindowOpen");
      await time.increaseTo(ctx.deadlines[0] + 1n);
      await expectRevert(a.freelancer.write.submitWork([1n, 0n, h("late")]), "DeadlinePassed");
      await ctx.tx(a.buyer.write.reclaimMissedDeadline([1n, 0n]));
      const m = await milestone(ctx, 0);
      expect([m.status, m.paidToFreelancer, m.refundedToBuyer]).to.deep.equal([
        MS.Refunded,
        0n,
        500n,
      ]);
      expect(await balances(ctx)).to.deep.equal({ buyer: TOTAL, freelancer: 0n });
      await expectRevert(a.buyer.write.reclaimMissedDeadline([1n, 0n]), "InvalidStatus");
      await expectRevert(a.freelancer.write.submitWork([1n, 0n, h("x")]), "InvalidStatus");
    });

    it("buyer can reclaim a revision the freelancer never delivered", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v1")]));
      await ctx.tx(a.buyer.write.requestRevision([1n, 0n, h("r")]));
      await expectRevert(a.buyer.write.reclaimMissedDeadline([1n, 0n]), "WindowOpen");
      await time.increase(WINDOW + 1);
      await ctx.tx(a.buyer.write.reclaimMissedDeadline([1n, 0n]));
      expect((await balances(ctx)).buyer).to.equal(TOTAL);
    });
  });

  describe("T6 dispute and settlement", () => {
    it("only the right party disputes in the right state, and credits stay locked", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await expectRevert(a.buyer.write.raiseDispute([1n, 0n, h("d")]), "InvalidStatus"); // Funded
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v1")]));
      await expectRevert(a.freelancer.write.raiseDispute([1n, 0n, h("d")]), "NotBuyer");
      await expectRevert(a.stranger.write.raiseDispute([1n, 0n, h("d")]), "NotParty");
      await ctx.tx(a.buyer.write.raiseDispute([1n, 0n, h("d")]));
      expect((await milestone(ctx, 0)).status).to.equal(MS.Disputed);
      expect(await balances(ctx)).to.deep.equal({ buyer: 5500n, freelancer: 0n });
      expect((await ctx.checkConservation()).escrow).to.equal(500n);
    });

    it("lets the freelancer dispute a revision request, not the buyer", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v1")]));
      await ctx.tx(a.buyer.write.requestRevision([1n, 0n, h("r")]));
      await expectRevert(a.buyer.write.raiseDispute([1n, 0n, h("d")]), "NotFreelancer");
      await ctx.tx(a.freelancer.write.raiseDispute([1n, 0n, h("d")]));
      expect((await milestone(ctx, 0)).status).to.equal(MS.Disputed);
    });

    it("blocks the buyer's dispute after the review window", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      await ctx.tx(a.freelancer.write.submitWork([1n, 0n, h("v1")]));
      await time.increase(WINDOW + 1);
      await expectRevert(a.buyer.write.raiseDispute([1n, 0n, h("d")]), "WindowExpired");
    });

    for (const [name, toFreelancer, buyerCredits] of [
      ["full to freelancer", 500n, 5500n],
      ["full to buyer", 0n, 6000n],
      ["partial 70/30", 350n, 5650n],
    ] as const) {
      it(`resolver settles ${name}`, async () => {
        const ctx = await loadFixture(activeFixture);
        const a = await actors(ctx);
        await disputeMilestone(ctx, 0);
        await ctx.tx(a.resolver.write.resolveDispute([1n, 0n, toFreelancer, h("why")]));
        const m = await milestone(ctx, 0);
        expect([m.status, m.paidToFreelancer, m.refundedToBuyer]).to.deep.equal([
          MS.Resolved,
          toFreelancer,
          500n - toFreelancer,
        ]);
        expect(await balances(ctx)).to.deep.equal({
          buyer: buyerCredits,
          freelancer: toFreelancer,
        });
      });
    }

    it("rejects bad settlements and non-resolvers", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await disputeMilestone(ctx, 0);
      await expectRevert(a.resolver.write.resolveDispute([1n, 0n, 501n, h("x")]), "InvalidInput");
      await expectRevert(a.buyer.write.resolveDispute([1n, 0n, 0n, h("x")]), "NotResolver");
      await ctx.tx(a.resolver.write.resolveDispute([1n, 0n, 250n, h("x")]));
      await expectRevert(a.resolver.write.resolveDispute([1n, 0n, 250n, h("x")]), "InvalidStatus");
    });
  });

  describe("T7 isolation", () => {
    it("settling milestone 2 leaves milestones 1 and 3 untouched", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await runToAccept(ctx, 0);
      const first = await milestone(ctx, 0);
      const third = await milestone(ctx, 2);

      await disputeMilestone(ctx, 1);
      await expectRevert(a.buyer.write.fundMilestone([1n, 2n]), "OutOfOrder"); // locked behind the dispute
      await expectRevert(a.buyer.write.acceptWork([1n, 0n]), "InvalidStatus");
      await ctx.tx(a.resolver.write.resolveDispute([1n, 1n, 490n, h("70/30")]));

      expect(await milestone(ctx, 0)).to.deep.equal(first);
      expect(await milestone(ctx, 2)).to.deep.equal(third);
      expect(await balances(ctx)).to.deep.equal({ buyer: 5010n, freelancer: 990n });
      await ctx.tx(a.buyer.write.fundMilestone([1n, 2n])); // next milestone is free to start
    });
  });

  describe("T8 permissions sweep", () => {
    type Roles = "buyer" | "freelancer" | "resolver" | "stranger";
    type Actor = Awaited<ReturnType<typeof actors>>["buyer"];
    const x = h("x");
    // [function, call, roles that must be rejected, error]; role checks run before state checks.
    const rows: [string, (c: Actor) => Promise<unknown>, Roles[], string][] = [
      ["approve", (c) => c.write.approve([2n]), ["resolver", "stranger"], "NotParty"],
      ["cancelProposal", (c) => c.write.cancelProposal([2n]), ["resolver", "stranger"], "NotParty"],
      [
        "fundMilestone",
        (c) => c.write.fundMilestone([1n, 0n]),
        ["freelancer", "resolver", "stranger"],
        "NotBuyer",
      ],
      [
        "submitWork",
        (c) => c.write.submitWork([1n, 0n, x]),
        ["buyer", "resolver", "stranger"],
        "NotFreelancer",
      ],
      [
        "acceptWork",
        (c) => c.write.acceptWork([1n, 0n]),
        ["freelancer", "resolver", "stranger"],
        "NotBuyer",
      ],
      [
        "requestRevision",
        (c) => c.write.requestRevision([1n, 0n, x]),
        ["freelancer", "resolver", "stranger"],
        "NotBuyer",
      ],
      [
        "claimAfterReviewTimeout",
        (c) => c.write.claimAfterReviewTimeout([1n, 0n]),
        ["buyer", "resolver", "stranger"],
        "NotFreelancer",
      ],
      [
        "reclaimMissedDeadline",
        (c) => c.write.reclaimMissedDeadline([1n, 0n]),
        ["freelancer", "resolver", "stranger"],
        "NotBuyer",
      ],
      [
        "raiseDispute",
        (c) => c.write.raiseDispute([1n, 0n, x]),
        ["resolver", "stranger"],
        "NotParty",
      ],
      [
        "resolveDispute",
        (c) => c.write.resolveDispute([1n, 0n, 0n, x]),
        ["buyer", "freelancer", "stranger"],
        "NotResolver",
      ],
    ];
    for (const [fn, call, roles, error] of rows) {
      it(`${fn}: ${roles.join(", ")} -> ${error}`, async () => {
        const ctx = await loadFixture(activeFixture);
        const a = await actors(ctx);
        const [buyer, freelancer, resolver] = ctx.terms;
        await ctx.tx(
          a.buyer.write.propose([buyer, freelancer, resolver, h("t2"), WINDOW, ctx.inputs]),
        ); // agreement 2, Proposed
        for (const role of roles) await expectRevert(call(a[role]), error);
      });
    }

    it("propose: only a party may call it", async () => {
      const ctx = await loadFixture(deployFixture);
      const base = await baseProposal(ctx);
      for (const w of [ctx.stranger, ctx.resolver]) {
        await expectRevert(
          ctx.ledger.write.propose(
            [base.buyer, base.freelancer, base.resolver, base.hash, base.window, base.inputs],
            { account: w.account },
          ),
          "NotParty",
        );
      }
    });
  });

  describe("T9 conservation", () => {
    it("the helper sees escrow, not just balances", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await ctx.tx(a.buyer.write.fundMilestone([1n, 0n]));
      expect(await ctx.checkConservation()).to.deep.equal({ available: 5500n, escrow: 500n });
    });

    it("demo script ends at 4,710 + 1,290 = 6,000 with no ETH in the contract", async () => {
      const ctx = await loadFixture(activeFixture);
      const a = await actors(ctx);
      await runToAccept(ctx, 0); // golden path
      await disputeMilestone(ctx, 1); // dispute path, 70/30
      await ctx.tx(a.resolver.write.resolveDispute([1n, 1n, 490n, h("70/30")]));
      await ctx.tx(a.buyer.write.fundMilestone([1n, 2n])); // timeout path
      await ctx.tx(a.freelancer.write.submitWork([1n, 2n, h("v1")]));
      await time.increase(WINDOW + 1);
      await ctx.tx(a.freelancer.write.claimAfterReviewTimeout([1n, 2n]));
      expect(await balances(ctx)).to.deep.equal({ buyer: 4710n, freelancer: 1290n });
      expect(await ctx.checkConservation()).to.deep.equal({ available: TOTAL, escrow: 0n });
      expect((await ctx.ledger.read.getAgreement([1n])).status).to.equal(AS.Completed);
    });
  });
});

// ------------------------------------------------------------------ local helpers

type Ctx = Awaited<ReturnType<typeof activeFixture>>;
type Base = Awaited<ReturnType<typeof baseProposal>> & { caller?: string };
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const ZERO_HASH = `0x${"0".repeat(64)}` as const;
const ms = (now: number, days: number) => ({
  credits: 100n,
  deadline: BigInt(now + days * DAY),
  revisionLimit: 1,
});

async function baseProposal(ctx: Awaited<ReturnType<typeof deployFixture>>) {
  const now = await time.latest();
  return {
    buyer: ctx.buyer.account.address as `0x${string}`,
    freelancer: ctx.freelancer.account.address as `0x${string}`,
    resolver: ctx.resolver.account.address as `0x${string}`,
    hash: h("terms") as `0x${string}`,
    window: WINDOW as number,
    inputs: [ms(now, 10)] as { credits: bigint; deadline: bigint; revisionLimit: number }[],
    now,
    caller: undefined as string | undefined,
  };
}

async function proposedFixture() {
  const ctx = await loadFixture(deployFixture);
  const base = await baseProposal(ctx);
  await ctx.tx(
    ctx.ledger.write.propose(
      [base.buyer, base.freelancer, base.resolver, base.hash, base.window, base.inputs],
      { account: ctx.buyer.account },
    ),
  );
  return { ...ctx, id: 1n };
}

/** fund -> submit -> accept for milestone `i` of agreement 1. */
async function runToAccept(ctx: Ctx, i: number) {
  const a = await actors(ctx);
  const idx = BigInt(i);
  await ctx.tx(a.buyer.write.fundMilestone([1n, idx]));
  await ctx.tx(a.freelancer.write.submitWork([1n, idx, h(`evidence-${i}`)]));
  await ctx.tx(a.buyer.write.acceptWork([1n, idx]));
}

/** fund -> submit -> buyer dispute for milestone `i` of agreement 1. */
async function disputeMilestone(ctx: Ctx, i: number) {
  const a = await actors(ctx);
  const idx = BigInt(i);
  await ctx.tx(a.buyer.write.fundMilestone([1n, idx]));
  await ctx.tx(a.freelancer.write.submitWork([1n, idx, h(`evidence-${i}`)]));
  await ctx.tx(a.buyer.write.raiseDispute([1n, idx, h("dispute")]));
}
