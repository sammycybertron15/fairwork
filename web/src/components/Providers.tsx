"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/chain/config";

import { ToastProvider } from "@/components/Toast";
import { PersonaProvider } from "@/lib/demo/persona-context";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PersonaProvider>{children}</PersonaProvider>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
