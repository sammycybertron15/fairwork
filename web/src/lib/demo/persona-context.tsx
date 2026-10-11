"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { getRpcUrl, localChain } from "@/lib/chain/config";
import {
  DEMO_PERSONAS,
  DEMO_PERSONA_LIST,
  PRIMARY_PERSONAS,
  SECONDARY_PERSONAS,
  getPersonaById,
  type DemoPersona,
  type DemoPersonaId,
} from "./personas";

export interface PersonaContextValue {
  persona: DemoPersona;
  address: Address;
  allPersonas: DemoPersona[];
  primaryPersonas: DemoPersona[];
  secondaryPersonas: DemoPersona[];
  setPersonaId: (id: DemoPersonaId | string) => void;
  isInjected: boolean;
  setIsInjected: (val: boolean) => void;
  toggleInjected: () => void;
  walletClient: WalletClient;
  publicClient: PublicClient;
  hasSelectedPersona: boolean;
  markPersonaSelected: () => void;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

const STORAGE_KEY = "fairwork_persona";
const INJECTED_KEY = "fairwork_use_injected";

export function PersonaProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { address: wagmiAddress, isConnected: isWagmiConnected } = useAccount();

  const [personaId, setPersonaIdState] = useState<DemoPersonaId>("buyer");
  const [isInjected, setIsInjectedState] = useState<boolean>(false);
  const [hasSelectedPersona, setHasSelectedPersona] = useState<boolean>(false);

  // Initialize from localStorage or cookie on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedPersona = localStorage.getItem(STORAGE_KEY);
      if (savedPersona && (savedPersona in DEMO_PERSONAS || savedPersona === "freelancer")) {
        setPersonaIdState(savedPersona as DemoPersonaId);
        setHasSelectedPersona(true);
      } else {
        // Check cookie
        const match = document.cookie.match(new RegExp(`(^| )${STORAGE_KEY}=([^;]+)`));
        if (match && (match[2] in DEMO_PERSONAS || match[2] === "freelancer")) {
          setPersonaIdState(match[2] as DemoPersonaId);
          setHasSelectedPersona(true);
        }
      }

      const savedInjected = localStorage.getItem(INJECTED_KEY);
      if (savedInjected === "true") {
        setIsInjectedState(true);
      }
    } catch {
      // Storage access blocked or restricted
    }
  }, []);

  const persona = useMemo(() => getPersonaById(personaId), [personaId]);

  const setPersonaId = useCallback(
    (id: DemoPersonaId | string) => {
      const normalized = id === "freelancer" ? "leon" : id;
      setPersonaIdState(normalized as DemoPersonaId);
      setHasSelectedPersona(true);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, normalized);
          document.cookie = `${STORAGE_KEY}=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
          window.dispatchEvent(
            new CustomEvent("fairwork-persona-changed", { detail: { id: normalized } }),
          );
        } catch {
          // Ignore
        }
      }

      // Invalidate queries so that contract reads and balances immediately reflect the new persona
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const setIsInjected = useCallback((val: boolean) => {
    setIsInjectedState(val);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(INJECTED_KEY, String(val));
      } catch {
        // Ignore
      }
    }
  }, []);

  const toggleInjected = useCallback(() => {
    setIsInjectedState((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(INJECTED_KEY, String(next));
        } catch {
          // Ignore
        }
      }
      return next;
    });
  }, []);

  const markPersonaSelected = useCallback(() => {
    setHasSelectedPersona(true);
  }, []);

  // Compute active address: if injected mode is explicitly toggled and wallet is connected, use wagmiAddress; otherwise persona address
  const activeAddress: Address = useMemo(() => {
    if (isInjected && isWagmiConnected && wagmiAddress) {
      return wagmiAddress;
    }
    return persona.address;
  }, [isInjected, isWagmiConnected, wagmiAddress, persona.address]);

  // Viem Clients configured for active persona's private key
  const rpcUrl = useMemo(() => getRpcUrl(), []);

  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: localChain,
      transport: http(rpcUrl),
    });
  }, [rpcUrl]);

  const walletClient = useMemo(() => {
    const account = privateKeyToAccount(persona.privateKey);
    return createWalletClient({
      account,
      chain: localChain,
      transport: http(rpcUrl),
    });
  }, [persona.privateKey, rpcUrl]);

  const value = useMemo(
    () => ({
      persona,
      address: activeAddress,
      allPersonas: DEMO_PERSONA_LIST,
      primaryPersonas: PRIMARY_PERSONAS,
      secondaryPersonas: SECONDARY_PERSONAS,
      setPersonaId,
      isInjected,
      setIsInjected,
      toggleInjected,
      walletClient,
      publicClient,
      hasSelectedPersona,
      markPersonaSelected,
    }),
    [
      persona,
      activeAddress,
      setPersonaId,
      isInjected,
      setIsInjected,
      toggleInjected,
      walletClient,
      publicClient,
      hasSelectedPersona,
      markPersonaSelected,
    ],
  );

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona(): PersonaContextValue {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error("usePersona must be used within a PersonaProvider");
  }
  return context;
}
