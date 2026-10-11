import { createConfig, createConnector, http, injected } from "wagmi";
import { mock } from "@wagmi/core";
import { hardhat } from "wagmi/chains";
import { DEMO_PERSONA_LIST } from "@/lib/demo/personas";
import type { Address } from "viem";

export function getRpcUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/rpc`;
  }
  return process.env.INTERNAL_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
}

export const RPC_URL = getRpcUrl();

/** Hardhat's chain (id 31337), named for the UI and pointed at our proxy RPC. */
export const localChain = {
  ...hardhat,
  name: "Hardhat Local",
  rpcUrls: { default: { http: [getRpcUrl()] } },
} as const;

export const LOCAL_CHAIN_ID = localChain.id;

function personaMockConnector(id: string, name: string, address: Address) {
  const m = mock({
    accounts: [address],
    features: { defaultConnected: false },
  });
  return createConnector((config) => {
    const c = m(config);
    return {
      ...c,
      id,
      name,
    };
  });
}

/** Injected provider (MetaMask) + simulated demo persona connectors. */
export const wagmiConfig = createConfig({
  chains: [localChain],
  connectors: [
    injected(),
    ...DEMO_PERSONA_LIST.map((p) => personaMockConnector(p.connectorId, p.label, p.address)),
  ],
  multiInjectedProviderDiscovery: false,
  transports: { [localChain.id]: http(getRpcUrl()) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
