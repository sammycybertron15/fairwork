import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

export type DecodedTxError = { name: string; message: string };

/**
 * Turns whatever a failed transaction threw into one short name for the UI: the contract's custom
 * error (e.g. "NotBuyer"), "UserRejectedRequestError" for a dismissed wallet prompt, or the viem
 * error class as a last resort.
 */
export function decodeTxError(error: unknown): DecodedTxError {
  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return { name: reverted.data?.errorName ?? "Reverted", message: error.shortMessage };
    }
    if (error.walk((e) => e instanceof UserRejectedRequestError)) {
      return {
        name: "UserRejectedRequestError",
        message: "You rejected the request in your wallet",
      };
    }
    return { name: error.name, message: error.shortMessage };
  }
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "UnknownError", message: "Transaction failed" };
}
