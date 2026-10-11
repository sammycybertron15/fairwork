"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getRpcUrl } from "@/lib/chain/config";

const DEV_TOOLS_ENABLED = process.env.NEXT_PUBLIC_DEV_TOOLS !== "false";

const TIME_OPTIONS = [
  { label: "+1 Hour", seconds: 3600 },
  { label: "+1 Day", seconds: 86400 },
  { label: "+7 Days", seconds: 7 * 86400 },
] as const;

export function DevTimeControls() {
  const queryClient = useQueryClient();
  const [advancing, setAdvancing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!DEV_TOOLS_ENABLED) return null;

  async function advanceTime(seconds: number, label: string) {
    if (advancing) return;
    setAdvancing(true);
    setFeedback(null);

    try {
      const rpcUrl = getRpcUrl();
      // 1. evm_increaseTime
      const incRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "evm_increaseTime",
          params: [seconds],
        }),
      });

      if (!incRes.ok) {
        throw new Error(`RPC error ${incRes.status}`);
      }

      // 2. evm_mine
      const mineRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now() + 1,
          method: "evm_mine",
          params: [],
        }),
      });

      if (!mineRes.ok) {
        throw new Error(`RPC mine error ${mineRes.status}`);
      }

      // 3. Invalidate all contract reads & queries
      await queryClient.invalidateQueries();
      window.dispatchEvent(new CustomEvent("dev-time-advanced", { detail: { seconds } }));

      setFeedback(`Advanced ${label}`);
      window.setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed to advance time");
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Development Time Travel Controls"
      className="flex flex-wrap items-center gap-2 rounded-tag border border-stone-soft bg-canvas px-3 py-1.5 font-mono text-[0.75rem]"
    >
      <span className="font-sans font-medium text-ink">Dev Time:</span>
      {TIME_OPTIONS.map((opt) => (
        <button
          key={opt.seconds}
          type="button"
          disabled={advancing}
          onClick={() => void advanceTime(opt.seconds, opt.label)}
          className="rounded-tag border border-stone-soft bg-canvas px-2 py-0.5 text-ink hover:border-lime-deep hover:bg-stone-soft/30 disabled:opacity-50"
        >
          {opt.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") {
            try {
              localStorage.clear();
              sessionStorage.clear();
              document.cookie.split(";").forEach((c) => {
                document.cookie = c
                  .replace(/^ +/, "")
                  .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
              });
            } catch {
              // Ignore
            }
            window.location.href = "/";
          }
        }}
        className="rounded-tag border border-stone-soft bg-canvas px-2 py-0.5 text-stone hover:border-danger hover:text-danger hover:bg-danger/10 transition-colors"
        title="Clear browser persona/session and return to initial role selector"
      >
        ↺ Reset Session
      </button>
      {feedback && (
        <span
          className={`ml-1 font-sans ${feedback.includes("Failed") ? "text-danger" : "text-lime-deep"}`}
        >
          {feedback}
        </span>
      )}
    </div>
  );
}
