"use client";

import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { LOCAL_CHAIN_ID } from "./config";
import { ledger } from "./contract";

// Reads always target the local chain, even while the wallet sits on another network.

/** Credits the account holds outside escrow (the ledger's `available` balance). */
export function useAvailableOf(account: Address | undefined) {
  return useReadContract({
    ...ledger,
    chainId: LOCAL_CHAIN_ID,
    functionName: "availableOf",
    args: account ? [account] : undefined,
    query: { enabled: account !== undefined },
  });
}

export function useAgreement(id: bigint | undefined) {
  return useReadContract({
    ...ledger,
    chainId: LOCAL_CHAIN_ID,
    functionName: "getAgreement",
    args: id === undefined ? undefined : [id],
    query: { enabled: id !== undefined },
  });
}

export function useMilestones(id: bigint | undefined) {
  return useReadContract({
    ...ledger,
    chainId: LOCAL_CHAIN_ID,
    functionName: "getMilestones",
    args: id === undefined ? undefined : [id],
    query: { enabled: id !== undefined },
  });
}

/** True when a wallet is connected but is not on Hardhat Local. */
export function useIsWrongNetwork(): boolean {
  const { isConnected, chainId } = useAccount();
  return isConnected && chainId !== LOCAL_CHAIN_ID;
}
