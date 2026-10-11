"use client";

import type { Address } from "viem";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { LOCAL_CHAIN_ID } from "@/lib/chain/config";
import { useAvailableOf, useIsWrongNetwork } from "@/lib/chain/hooks";
import { usePersona } from "@/lib/demo/persona-context";
import { formatCredits, shortHex } from "@/lib/format";
import { Spinner } from "@/components/Spinner";

function CreditBalance({ account }: { account: Address }) {
  const { data, isPending, isError } = useAvailableOf(account);
  let label = "Reading balance…";
  if (isError) label = "0 credits";
  else if (!isPending && data !== undefined) label = formatCredits(data);
  return (
    <span className="font-mono text-caption font-medium" aria-label="Available credits">
      {label}
    </span>
  );
}

export function ConnectWalletButton() {
  const { persona, address, isInjected, toggleInjected } = usePersona();
  const { address: wagmiAddress, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const wrongNetwork = useIsWrongNetwork();

  function handleConnectMetaMask() {
    const injectedConnector = connectors.find((c) => c.id === "injected");
    if (injectedConnector) {
      connect({ connector: injectedConnector, chainId: LOCAL_CHAIN_ID });
    }
  }

  // In simulated persona mode (default for multi-device/tunnel), user is always connected
  if (!isInjected) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-tag border border-stone-soft bg-canvas px-2.5 py-1 text-caption font-medium text-ink">
            <span aria-hidden className="inline-block size-2 rounded-circle bg-lime" />
            <span className="font-mono">{persona.name}</span>
          </span>
          <span className="font-mono text-caption text-muted-on-light" title={address}>
            {shortHex(address)}
          </span>
        </div>
        <CreditBalance account={address} />
        <button
          type="button"
          onClick={toggleInjected}
          className="rounded-tag border border-stone-soft px-2 py-0.5 font-mono text-[0.7rem] text-muted-on-light hover:border-ink hover:text-ink transition-colors"
          title="Switch to injected MetaMask wallet"
        >
          MetaMask
        </button>
      </div>
    );
  }

  // In injected wallet mode
  if (!isConnected || !wagmiAddress) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={isPending || connectors.length === 0}
          onClick={handleConnectMetaMask}
        >
          {isPending ? (
            <>
              <Spinner className="mr-2 size-4 animate-spin text-ink" />
              Connecting…
            </>
          ) : (
            "Connect MetaMask"
          )}
        </button>
        <button
          type="button"
          onClick={toggleInjected}
          className="rounded-tag border border-stone-soft px-2 py-1 font-mono text-[0.7rem] text-muted-on-light hover:border-ink hover:text-ink transition-colors"
          title="Switch back to simulated persona client"
        >
          Use Persona
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      <span className="font-mono text-caption" title={wagmiAddress}>
        {shortHex(wagmiAddress)}
      </span>
      {wrongNetwork ? (
        <button
          type="button"
          className="btn-destructive"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: LOCAL_CHAIN_ID })}
        >
          {isSwitching ? "Switching…" : "Switch to Hardhat Local"}
        </button>
      ) : (
        <CreditBalance account={wagmiAddress} />
      )}
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          disconnect();
          toggleInjected();
        }}
      >
        Disconnect
      </button>
    </div>
  );
}
