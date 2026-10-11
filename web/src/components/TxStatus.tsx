import { shortHex } from "@/lib/format";
import type { TxState } from "@/lib/chain/useLedgerWrite";

const MARKER: Record<Exclude<TxState["status"], "idle">, string> = {
  awaitingWallet: "border border-stone",
  pending: "bg-lime-deep",
  confirmed: "bg-lime",
  failed: "bg-danger",
};

/** One line for the four write states. Status is text first; the square is only a marker. */
export function TxStatus({ state }: { state: TxState }) {
  if (state.status === "idle") return null;

  let text: string;
  switch (state.status) {
    case "awaitingWallet":
      text = "Waiting for wallet…";
      break;
    case "pending":
      text = `Pending · tx ${shortHex(state.hash, 10, 8)}`;
      break;
    case "confirmed":
      text = "Confirmed";
      break;
    case "failed":
      text = `Failed: ${state.errorName}`;
      break;
  }

  return (
    <p role="status" className="flex items-center gap-2 text-caption">
      <span aria-hidden className={`inline-block size-2 ${MARKER[state.status]}`} />
      <span className={state.status === "failed" ? "text-danger" : undefined}>{text}</span>
      {state.status === "failed" ? (
        <span className="text-muted-on-light">({state.message})</span>
      ) : null}
    </p>
  );
}
