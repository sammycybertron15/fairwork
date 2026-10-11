import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { keccak256, stringToHex, type Hex } from "viem";

export const TOTAL = 6000n;
export const DAY = 86_400;
export const WINDOW = 3 * DAY; // review window used by the fixtures

// MilestoneStatus / AgreementStatus enum values, mirroring the contract.
export const MS = {
  Unfunded: 0,
  Funded: 1,
  Submitted: 2,
  RevisionRequested: 3,
  Disputed: 4,
  Accepted: 5,
  Resolved: 6,
  Refunded: 7,
} as const;
export const AS = { Proposed: 0, Active: 1, Completed: 2, Cancelled: 3 } as const;

export const h = (label: string): Hex => keccak256(stringToHex(label));

/** Revert check by custom error name (all of the contract's errors take no arguments). */
export async function expectRevert(promise: Promise<unknown>, errorName: string) {
  try {
    await promise;
  } catch (e) {
    const text =
      e instanceof Error
        ? `${e.message}\n${String((e as { details?: string }).details)}`
        : String(e);
    expect(text, `expected ${errorName}, got: ${text.slice(0, 300)}`).to.include(`${errorName}(`);
    return;
  }
  expect.fail(`expected revert with ${errorName}, but the call succeeded`);
}

/** Any failure counts (used where the node gives no custom error, e.g. a plain ETH transfer). */
export async function expectFail(promise: Promise<unknown>) {
  try {
    await promise;
  } catch {
    return;
  }
  expect.fail("expected the call to fail, but it succeeded");
}

async function setup() {
  const wallets = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const [deployer, freelancer, stranger, , buyer, , , , , resolver] = wallets;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ledger: any = await hre.viem.deployContract("FairworkLedger", [buyer.account.address]);
  const addresses = wallets.map((w) => w.account.address);

  /** The ledger as seen by another caller. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const as = (wallet: (typeof wallets)[number]): Promise<any> =>
    hre.viem.getContractAt("FairworkLedger", ledger.address, { client: { wallet } }) as any;

  /** Escrow total and balance sum across every test account, plus the I1 / I3 / I8 checks. */
  async function checkConservation() {
    let available = 0n;
    for (const a of addresses) available += await ledger.read.availableOf([a]);
    let escrow = 0n;
    const count = await ledger.read.agreementCount();
    for (let id = 1n; id <= count; id++) {
      for (const m of await ledger.read.getMilestones([id])) {
        if (m.status >= MS.Funded && m.status <= MS.Disputed) escrow += m.credits;
        if (m.status >= MS.Accepted) {
          expect(m.paidToFreelancer + m.refundedToBuyer, "I3").to.equal(m.credits);
        }
      }
    }
    expect(available + escrow, "I1: credits conserved").to.equal(await ledger.read.totalIssued());
    expect(await publicClient.getBalance({ address: ledger.address }), "I8: no ETH").to.equal(0n);
    return { available, escrow };
  }

  /** Wait for a transaction, then assert the invariants. Every state change in a test goes here. */
  async function tx(hash: Promise<Hex>) {
    await publicClient.waitForTransactionReceipt({ hash: await hash });
    await checkConservation();
  }

  return {
    wallets,
    deployer,
    freelancer,
    stranger,
    buyer,
    resolver,
    ledger,
    publicClient,
    as,
    tx,
    checkConservation,
  };
}

export async function deployFixture() {
  return setup();
}

/** Active agreement #1: three milestones of 500, 700 and 300 credits, 3-day review window. */
export async function activeFixture() {
  const ctx = await setup();
  const now = await time.latest();
  const deadlines = [now + 10 * DAY, now + 20 * DAY, now + 30 * DAY].map(BigInt);
  const inputs = [
    { credits: 500n, deadline: deadlines[0], revisionLimit: 1 },
    { credits: 700n, deadline: deadlines[1], revisionLimit: 2 },
    { credits: 300n, deadline: deadlines[2], revisionLimit: 0 },
  ];
  const { ledger, buyer, freelancer, resolver, tx } = ctx;
  const terms = [
    buyer.account.address,
    freelancer.account.address,
    resolver.account.address,
    h("terms"),
  ] as const;
  await tx(ledger.write.propose([...terms, WINDOW, inputs], { account: buyer.account }));
  const asFreelancer = await ctx.as(freelancer);
  await tx(asFreelancer.write.approve([1n]));
  return { ...ctx, id: 1n, inputs, deadlines, terms };
}

/** Role-bound contract handles for an agreement, so tests read like the story they tell. */
export async function actors(ctx: Awaited<ReturnType<typeof activeFixture>>) {
  return {
    buyer: await ctx.as(ctx.buyer),
    freelancer: await ctx.as(ctx.freelancer),
    resolver: await ctx.as(ctx.resolver),
    stranger: await ctx.as(ctx.stranger),
  };
}

export const balances = async (ctx: Awaited<ReturnType<typeof activeFixture>>) => ({
  buyer: await ctx.ledger.read.availableOf([ctx.buyer.account.address]),
  freelancer: await ctx.ledger.read.availableOf([ctx.freelancer.account.address]),
});

export const milestone = async (ctx: Awaited<ReturnType<typeof activeFixture>>, i: number) =>
  (await ctx.ledger.read.getMilestones([ctx.id]))[i];

export { time };
