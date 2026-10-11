"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { usePersona } from "@/lib/demo/persona-context";
import { shortHex } from "@/lib/format";

export function DemoWalletBar() {
  const {
    persona,
    primaryPersonas,
    secondaryPersonas,
    setPersonaId,
    isInjected,
    toggleInjected,
    address,
  } = usePersona();

  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <aside
      aria-label="Universal Persona Switcher"
      className="sticky top-0 z-40 border-b border-stone/20 bg-ink px-4 py-2 text-caption text-canvas shadow-xs"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Left: Role Switcher Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[0.72rem] uppercase tracking-wider text-stone">
            <span
              aria-hidden
              className="inline-block size-2 rounded-circle bg-lime animate-pulse"
            />
            Persona:
          </span>

          {/* 3 Primary Roles */}
          <div className="flex flex-wrap items-center gap-1.5">
            {primaryPersonas.map((p) => {
              const isActive = persona.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPersonaId(p.id);
                    setMoreOpen(false);
                  }}
                  title={`Switch to ${p.label} (${p.address})`}
                  className={`inline-flex items-center gap-1.5 rounded-card px-2.5 py-1 font-mono text-[0.75rem] font-medium transition-colors ${
                    isActive
                      ? "border border-lime bg-lime text-ink font-semibold shadow-xs"
                      : "border border-stone/30 bg-transparent text-stone hover:border-canvas hover:text-canvas"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-circle ${isActive ? "bg-ink" : "bg-stone"}`}
                  />
                  <span>{p.label}</span>
                </button>
              );
            })}

            {/* Secondary Personas Dropdown */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setMoreOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded-card px-2.5 py-1 font-mono text-[0.75rem] transition-colors ${
                  secondaryPersonas.some((sp) => sp.id === persona.id)
                    ? "border border-lime bg-lime/20 text-lime font-semibold"
                    : "border border-stone/30 bg-transparent text-stone hover:border-canvas hover:text-canvas"
                }`}
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                <span>
                  {secondaryPersonas.some((sp) => sp.id === persona.id)
                    ? persona.name
                    : "More Roles"}
                </span>
                <span className="text-[0.65rem]">{moreOpen ? "▲" : "▼"}</span>
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-1.5 w-64 rounded-panel border border-stone/30 bg-ink p-1.5 shadow-lg z-50 flex flex-col gap-1"
                >
                  <div className="px-2 py-1 text-[0.7rem] uppercase font-mono tracking-wider text-stone/80">
                    Additional Freelancers:
                  </div>
                  {secondaryPersonas.map((sp) => {
                    const isActive = persona.id === sp.id;
                    return (
                      <button
                        key={sp.id}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setPersonaId(sp.id);
                          setMoreOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-card px-2.5 py-1.5 text-left font-mono text-[0.75rem] transition-colors ${
                          isActive
                            ? "bg-lime text-ink font-semibold"
                            : "text-canvas hover:bg-stone/20"
                        }`}
                      >
                        <span>{sp.label}</span>
                        <span className="text-[0.7rem] opacity-75">{sp.handle}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Active Status & Viem Mode Toggle */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[0.75rem] text-stone">
          <div className="flex items-center gap-1.5">
            <span className="text-canvas font-medium">{shortHex(address)}</span>
            <CopyButton value={address} label={`Copy ${persona.name} address`} />
          </div>

          {/* Toggle between Instant Viem Client vs Injected MetaMask */}
          <button
            type="button"
            onClick={toggleInjected}
            title={
              isInjected
                ? "Currently using injected browser provider (MetaMask). Click to switch to Simulated Viem Client."
                : "Currently using Viem Client signed with persona private key (perfect for phone/tunnel testing). Click to switch to MetaMask."
            }
            className={`inline-flex items-center gap-1 rounded-tag px-2 py-0.5 text-[0.7rem] transition-colors ${
              isInjected
                ? "border border-warning/50 bg-warning/20 text-warning"
                : "border border-lime/40 bg-lime/10 text-lime hover:bg-lime/20"
            }`}
          >
            <span>{isInjected ? "🦊 Injected (MetaMask)" : "⚡ Viem Client"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
