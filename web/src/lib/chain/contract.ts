import type { Address } from "viem";
// Both files are written by `npm run deploy:local` (chain/scripts/deploy-local.ts). Never edit them.
import { fairworkLedgerAbi } from "@/generated/abi";
import deployment from "@/generated/deployment.json";

export const ledger = {
  address: deployment.address as Address,
  abi: fairworkLedgerAbi,
} as const;
