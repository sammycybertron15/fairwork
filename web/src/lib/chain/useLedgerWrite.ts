"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type { ContractFunctionArgs, ContractFunctionName, Hash } from "viem";
import { useAccount, useConfig } from "wagmi";
import { simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { useToast } from "@/components/Toast";
import { usePersona } from "@/lib/demo/persona-context";
import { LOCAL_CHAIN_ID } from "./config";
import { ledger } from "./contract";
import { decodeTxError } from "./errors";
import { useIsWrongNetwork } from "./hooks";

type LedgerAbi = typeof ledger.abi;
export type LedgerWriteName = ContractFunctionName<LedgerAbi, "nonpayable">;

const TOAST_MESSAGES: Record<string, string> = {
  fundMilestone: "Milestone funded successfully",
  submitWork: "Deliverable submitted",
  requestRevision: "Revision requested",
  raiseDispute: "Dispute opened",
  acceptWork: "Milestone accepted & payment released",
  resolveDispute: "Dispute resolved successfully",
  approve: "Agreement approved",
  propose: "Agreement proposed successfully",
  cancelProposal: "Proposal cancelled",
  claimAfterReviewTimeout: "Credits claimed after review timeout",
  reclaimMissedDeadline: "Credits reclaimed after missed deadline",
};

/** The four states the UI shows for any write (spec 8.3), plus `idle` before the first click. */
export type TxState =
  | { status: "idle" }
  | { status: "awaitingWallet" }
  | { status: "pending"; hash: Hash }
  | { status: "confirmed"; hash: Hash }
  | { status: "failed"; errorName: string; message: string; hash?: Hash };

const IDLE: TxState = { status: "idle" };

/**
 * One write helper for every ledger function. Usage:
 *   const tx = useLedgerWrite();
 *   <button disabled={tx.disabled} onClick={() => tx.send("approve", [1n])} />
 *
 * Routes writes through the active persona's Viem Wallet Client (simulated / instant key),
 * falling back to injected wallet (MetaMask) only if explicitly toggled.
 */
export function useLedgerWrite() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isConnected } = useAccount();
  const wrongNetwork = useIsWrongNetwork();
  const { isInjected, walletClient, publicClient } = usePersona();
  const [state, setState] = useState<TxState>(IDLE);
  const inFlight = useRef(false);

  const send = useCallback(
    async <F extends LedgerWriteName>(
      functionName: F,
      args: ContractFunctionArgs<LedgerAbi, "nonpayable", F>,
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState({ status: "awaitingWallet" });
      let hash: Hash | undefined;
      try {
        if (isInjected && isConnected) {
          // Injected wallet mode (MetaMask)
          const request = { ...ledger, chainId: LOCAL_CHAIN_ID, functionName, args } as never;
          const simulated = await simulateContract(config, request);
          hash = await writeContract(config, simulated.request as never);
          setState({ status: "pending", hash });
          const receipt = await waitForTransactionReceipt(config, {
            hash,
            chainId: LOCAL_CHAIN_ID,
          });
          if (receipt.status === "reverted") {
            setState({
              status: "failed",
              errorName: "Reverted",
              message: "Transaction reverted",
              hash,
            });
            return;
          }
        } else {
          // Viem Wallet Client mode: directly signed with persona's private key
          const account = walletClient.account;
          const simulated = await publicClient.simulateContract({
            address: ledger.address,
            abi: ledger.abi,
            functionName,
            args: args as never,
            account,
          });
          hash = await walletClient.writeContract(simulated.request as never);
          setState({ status: "pending", hash });
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === "reverted") {
            setState({
              status: "failed",
              errorName: "Reverted",
              message: "Transaction reverted",
              hash,
            });
            return;
          }
        }

        setState({ status: "confirmed", hash });
        const toastMsg = TOAST_MESSAGES[functionName];
        if (toastMsg) {
          showToast(toastMsg, "success");
        }
        await queryClient.invalidateQueries();
      } catch (error) {
        const { name, message } = decodeTxError(error);
        setState({ status: "failed", errorName: name, message, hash });
        showToast(message || "Transaction failed", "error");
      } finally {
        inFlight.current = false;
      }
    },
    [config, queryClient, showToast, isInjected, isConnected, walletClient, publicClient],
  );

  const reset = useCallback(() => setState(IDLE), []);
  const busy = state.status === "awaitingWallet" || state.status === "pending";
  const disabled = busy || (isInjected ? !isConnected || wrongNetwork : false);

  return { state, send, reset, disabled, wrongNetwork };
}
