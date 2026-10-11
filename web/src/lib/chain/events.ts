import type { Address, Hex, PublicClient } from "viem";
import { formatCredits } from "../format";
import { ledger } from "./contract";
import type { AgreementView, MilestoneView } from "../actions";
import type { AgreementWithMilestones } from "../selectors";

export type FormattedAgreementEvent = {
  eventName: string;
  displayTitle: string;
  description: string;
  credits?: bigint;
  txHash: Hex;
  blockNumber: bigint;
  timestamp: bigint; // Unix seconds
};

const STATUS_NAMES = ["Proposed", "Active", "Completed", "Cancelled"] as const;
const MILESTONE_STATUS_NAMES = [
  "Unfunded",
  "Funded",
  "Submitted",
  "RevisionRequested",
  "Disputed",
  "Accepted",
  "Resolved",
  "Refunded",
] as const;

/**
 * Reads all on-chain events for a specific agreement id, fetching block timestamps,
 * and formats them into plain English timeline items.
 */
export async function fetchAgreementEvents(
  publicClient: PublicClient,
  agreementId: bigint,
): Promise<FormattedAgreementEvent[]> {
  try {
    const rawLogs = await publicClient.getContractEvents({
      address: ledger.address,
      abi: ledger.abi,
      args: { id: agreementId },
      fromBlock: 0n,
    });

    if (!rawLogs || rawLogs.length === 0) return [];

    // Cache block timestamps so we don't query the same block repeatedly
    const blockTimestamps = new Map<bigint, bigint>();

    const getBlockTime = async (blockNumber: bigint): Promise<bigint> => {
      const cached = blockTimestamps.get(blockNumber);
      if (cached !== undefined) return cached;
      try {
        const block = await publicClient.getBlock({ blockNumber });
        const time = block.timestamp;
        blockTimestamps.set(blockNumber, time);
        return time;
      } catch {
        return 0n;
      }
    };

    const formatted: FormattedAgreementEvent[] = [];

    for (const log of rawLogs) {
      const { eventName, args, blockNumber, transactionHash } = log;
      if (!eventName || !transactionHash || blockNumber === null) continue;

      const timestamp = await getBlockTime(blockNumber);
      const mIdx =
        args && "index" in args && typeof args.index === "bigint"
          ? Number(args.index) + 1
          : undefined;

      let displayTitle: string = eventName;
      let description = "";
      let credits: bigint | undefined;

      switch (eventName) {
        case "AgreementProposed":
          displayTitle = "Agreement Proposed";
          description = `Terms proposed with hash ${args && "termsHash" in args ? String(args.termsHash).slice(0, 10) : ""}…`;
          break;
        case "AgreementApproved":
          displayTitle = "Agreement Approved";
          description = `Approved by ${args && "by" in args ? String(args.by).slice(0, 8) : ""}…`;
          break;
        case "AgreementActivated":
          displayTitle = "Agreement Activated";
          description = "Both parties approved. Agreement is now active.";
          break;
        case "AgreementCancelled":
          displayTitle = "Agreement Cancelled";
          description = "Proposal cancelled before both approvals.";
          break;
        case "AgreementCompleted":
          displayTitle = "Agreement Completed";
          description = "All milestones completed. Agreement closed.";
          break;
        case "MilestoneFunded":
          displayTitle = `Milestone ${mIdx} Funded`;
          credits = args && "credits" in args ? (args.credits as bigint) : undefined;
          description = credits
            ? `${formatCredits(credits)} locked in escrow.`
            : "Milestone funded into escrow.";
          break;
        case "WorkSubmitted":
          displayTitle = `Work Submitted for Milestone ${mIdx}`;
          description = "Freelancer submitted deliverable evidence.";
          break;
        case "RevisionRequested":
          displayTitle = `Revision Requested for Milestone ${mIdx}`;
          description = "Buyer requested revisions with feedback reason.";
          break;
        case "MilestoneAccepted":
          displayTitle = `Milestone ${mIdx} Accepted`;
          credits = args && "credits" in args ? (args.credits as bigint) : undefined;
          description = credits
            ? `${formatCredits(credits)} released to freelancer.`
            : "Milestone accepted and paid.";
          break;
        case "MilestoneRefunded":
          displayTitle = `Milestone ${mIdx} Refunded`;
          credits = args && "credits" in args ? (args.credits as bigint) : undefined;
          description = credits
            ? `${formatCredits(credits)} refunded to buyer.`
            : "Milestone refunded.";
          break;
        case "DisputeRaised":
          displayTitle = `Dispute Raised on Milestone ${mIdx}`;
          description = "Milestone disputed. Escrow locked pending resolution.";
          break;
        case "DisputeResolved": {
          displayTitle = `Dispute Resolved on Milestone ${mIdx}`;
          const toFreelancer = args && "toFreelancer" in args ? (args.toFreelancer as bigint) : 0n;
          const toBuyer = args && "toBuyer" in args ? (args.toBuyer as bigint) : 0n;
          credits = toFreelancer + toBuyer;
          description = `Resolver settled: ${formatCredits(toFreelancer)} to freelancer, ${formatCredits(toBuyer)} to buyer.`;
          break;
        }
        default:
          description = `Contract event ${eventName}`;
          break;
      }

      formatted.push({
        eventName,
        displayTitle,
        description,
        credits,
        txHash: transactionHash,
        blockNumber,
        timestamp,
      });
    }

    // Sort chronologically ascending
    return formatted.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return Number(a.blockNumber - b.blockNumber);
      }
      return Number(a.timestamp - b.timestamp);
    });
  } catch {
    return [];
  }
}

/**
 * Fetches all agreements and milestones from the contract for dashboard display.
 */
export async function fetchAllAgreementsWithMilestones(
  publicClient: PublicClient,
): Promise<AgreementWithMilestones[]> {
  try {
    const count = (await publicClient.readContract({
      ...ledger,
      functionName: "agreementCount",
    })) as bigint;

    if (count === 0n) return [];

    const ids: bigint[] = [];
    for (let i = 1n; i <= count; i++) {
      ids.push(i);
    }

    const items = await Promise.all(
      ids.map(async (id) => {
        const [rawAgreement, rawMilestones] = await Promise.all([
          publicClient.readContract({
            ...ledger,
            functionName: "getAgreement",
            args: [id],
          }) as Promise<{
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
          }>,
          publicClient.readContract({
            ...ledger,
            functionName: "getMilestones",
            args: [id],
          }) as Promise<
            Array<{
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
            }>
          >,
        ]);

        const agreement: AgreementView = {
          buyer: rawAgreement.buyer,
          freelancer: rawAgreement.freelancer,
          resolver: rawAgreement.resolver,
          reviewWindow: rawAgreement.reviewWindow,
          status: STATUS_NAMES[rawAgreement.status] ?? "Proposed",
          buyerApproved: rawAgreement.buyerApproved,
          freelancerApproved: rawAgreement.freelancerApproved,
          milestoneCount: rawAgreement.milestoneCount,
          openMilestones: rawAgreement.openMilestones,
          termsHash: rawAgreement.termsHash,
        };

        const milestones: MilestoneView[] = rawMilestones.map((m) => ({
          credits: m.credits,
          deadline: m.deadline,
          dueAt: m.dueAt,
          submittedAt: m.submittedAt,
          revisionLimit: m.revisionLimit,
          revisionsUsed: m.revisionsUsed,
          status: MILESTONE_STATUS_NAMES[m.status] ?? "Unfunded",
          evidenceHash: m.evidenceHash,
          paidToFreelancer: m.paidToFreelancer,
          refundedToBuyer: m.refundedToBuyer,
        }));

        return { id, agreement, milestones };
      }),
    );

    return items;
  } catch {
    return [];
  }
}
