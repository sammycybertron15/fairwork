"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePersona } from "@/lib/demo/persona-context";

export function RoleSelectModal() {
  const router = useRouter();
  const { setPersonaId } = usePersona();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPersona = localStorage.getItem("fairwork_persona");
      if (!savedPersona) {
        setIsOpen(true);
      }
    }
  }, []);

  function handleSelectBuyer() {
    setPersonaId("buyer");
    setIsOpen(false);
  }

  function handleSelectFreelancer() {
    setPersonaId("leon");
    setIsOpen(false);
    router.push("/dashboard?view=freelancer");
  }

  function handleSelectResolver() {
    setPersonaId("resolver");
    setIsOpen(false);
    router.push("/dashboard");
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-xl rounded-panel border border-stone/30 bg-ink p-8 text-canvas shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="flex items-center gap-2 font-mono text-[0.75rem] uppercase tracking-wider text-lime">
              <span
                aria-hidden
                className="inline-block size-2 rounded-circle bg-lime animate-pulse"
              />
              Multi-Device Session Setup
            </span>
            <h2
              id="role-modal-title"
              className="mt-2 font-heading text-title font-semibold text-canvas"
            >
              Select your role for this demo session
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-stone hover:text-canvas transition-colors"
            aria-label="Dismiss modal"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-caption text-stone leading-relaxed">
          Fairwork connects buyers, freelancers, and resolvers via escrow smart contracts. Each
          device or browser tab can adopt a distinct role for multi-party testing over your shared
          network or tunnel:
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {/* Option A: Buyer */}
          <button
            type="button"
            onClick={handleSelectBuyer}
            className="group flex flex-col items-start rounded-card border border-stone/30 bg-ink/90 p-4 text-left transition-all hover:border-lime hover:bg-stone/10"
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-heading text-lead font-medium text-canvas group-hover:text-lime">
                Buyer (Account #4)
              </span>
              <span className="font-mono text-caption text-lime font-semibold">6,000 Credits</span>
            </div>
            <p className="mt-1 text-caption text-stone">
              Browse storefronts, create proposals, and lock credits into escrow.
            </p>
          </button>

          {/* Option B: Freelancer */}
          <button
            type="button"
            onClick={handleSelectFreelancer}
            className="group flex flex-col items-start rounded-card border border-stone/30 bg-ink/90 p-4 text-left transition-all hover:border-lime hover:bg-stone/10"
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-heading text-lead font-medium text-canvas group-hover:text-lime">
                Freelancer: Leon Lobo (Account #1)
              </span>
              <span className="font-mono text-caption text-stone font-semibold">Motion & 3D</span>
            </div>
            <p className="mt-1 text-caption text-stone">
              Review proposals, submit deliverable evidence, and claim released funds.
            </p>
          </button>

          {/* Option C: Resolver */}
          <button
            type="button"
            onClick={handleSelectResolver}
            className="group flex flex-col items-start rounded-card border border-stone/30 bg-ink/90 p-4 text-left transition-all hover:border-lime hover:bg-stone/10"
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-heading text-lead font-medium text-canvas group-hover:text-lime">
                Resolver / Fairwork Desk (Account #9)
              </span>
              <span className="font-mono text-caption text-stone font-semibold">Support Desk</span>
            </div>
            <p className="mt-1 text-caption text-stone">
              Arbitrate milestone disputes and settle funds between buyer and freelancer.
            </p>
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-stone/20 pt-4 text-caption text-stone">
          <span>You can switch personas anytime using the top bar.</span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-canvas underline-offset-4 hover:underline"
          >
            Browse as visitor
          </button>
        </div>
      </div>
    </div>
  );
}
