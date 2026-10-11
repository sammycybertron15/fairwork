"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { formatCredits } from "@/lib/format";
import type { Tip } from "@/lib/db/tips";

type PostCompletionTipModuleProps = {
  agreementId: string | bigint;
  buyerAddress: string;
  freelancerAddress: string;
};

const PRESET_AMOUNTS = [25, 50, 100];

export function PostCompletionTipModule({
  agreementId,
  buyerAddress,
  freelancerAddress,
}: PostCompletionTipModuleProps) {
  const strAgreementId = String(agreementId);
  const toast = useToast();

  const [tips, setTips] = useState<Tip[]>([]);
  const [totalTips, setTotalTips] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTipped, setHasTipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadTips() {
      try {
        const res = await fetch(`/api/tips?agreementId=${encodeURIComponent(strAgreementId)}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setTips(data.tips || []);
            setTotalTips(data.totalTips || 0);
            if (data.totalTips > 0) {
              setHasTipped(true);
            }
          }
        }
      } catch {
        // Ignored
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadTips();
    return () => {
      mounted = false;
    };
  }, [strAgreementId]);

  const activeAmount = customAmount.trim() !== "" ? parseInt(customAmount, 10) : selectedPreset;

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount("");
    setError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^[0-9]+$/.test(val)) {
      setCustomAmount(val);
      setSelectedPreset(null);
      setError(null);
    }
  };

  const handleSubmitTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAmount || isNaN(activeAmount) || activeAmount <= 0) {
      setError("Please select or enter a valid tip amount (at least 1 credit).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId: strAgreementId,
          buyerAddress,
          freelancerAddress,
          amountCredits: activeAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit tip.");
      }

      const data = await res.json();
      setTips((prev) => [...prev, data.tip]);
      setTotalTips(data.totalTips);
      setHasTipped(true);
      setCustomAmount("");

      toast.success(`Tip of ${formatCredits(activeAmount)} sent to freelancer for great work!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record tip.");
      toast.error("Failed to send tip. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-card border border-stone-soft bg-canvas p-6 flex items-center justify-center gap-2 text-caption text-muted-on-light">
        <Spinner />
        <span>Loading tipping status...</span>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="post-completion-tip-heading"
      className="rounded-card border-2 border-lime/60 bg-gradient-to-br from-lime/5 via-canvas to-canvas p-6 flex flex-col gap-5 shadow-sm"
    >
      {/* Celebratory Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-circle bg-lime/20 text-lime-deep text-xl font-bold">
            🎉
          </div>
          <div>
            <h2 id="post-completion-tip-heading" className="text-lead font-semibold text-ink">
              Milestone Completed! Would you like to add a tip for great work?
            </h2>
            <p className="mt-0.5 text-caption text-muted-on-light">
              Reward your freelancer with bonus credits deposited directly to their balance.
            </p>
          </div>
        </div>

        {totalTips > 0 && (
          <div className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-tag border border-lime/40 bg-lime/15 px-3 py-1 font-mono text-caption font-semibold text-ink">
            <span className="text-lime-deep">✓</span>
            <span>Total Tipped: {formatCredits(totalTips)}</span>
          </div>
        )}
      </div>

      {hasTipped && tips.length > 0 && (
        <div className="rounded-tag border border-lime/30 bg-lime/10 p-3.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-caption font-medium text-ink">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-circle bg-lime" />
              Thank you! Your tip was recorded and credited to the freelancer.
            </span>
            <span className="font-mono text-muted-on-light">
              {tips.length} tip{tips.length > 1 ? "s" : ""} sent
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-tiny font-mono text-muted-on-light">
            {tips.map((t) => (
              <span
                key={t.id}
                className="rounded-tag bg-canvas/80 border border-stone-soft px-2 py-0.5"
              >
                +{formatCredits(t.amountCredits)}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-tag border border-danger/30 bg-danger/10 p-3 text-caption text-danger">
          {error}
        </div>
      )}

      {/* Preset & Custom Tip Controls */}
      <form onSubmit={handleSubmitTip} className="flex flex-col gap-4">
        <div>
          <label className="block text-caption font-medium text-ink mb-2">Select Tip Amount</label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_AMOUNTS.map((amt) => {
              const isSelected = selectedPreset === amt && customAmount === "";
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handlePresetClick(amt)}
                  className={`rounded-tag px-4 py-2 font-mono text-caption font-semibold transition-all ${
                    isSelected
                      ? "border-2 border-lime-deep bg-lime text-ink shadow-sm"
                      : "border border-stone-soft bg-canvas text-ink hover:border-ink hover:bg-stone/5"
                  }`}
                >
                  +{formatCredits(amt)}
                </button>
              );
            })}

            {/* Custom Input */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Custom"
                value={customAmount}
                onChange={handleCustomChange}
                className={`w-28 rounded-tag border px-3 py-2 font-mono text-caption text-ink placeholder:text-stone focus:outline-none ${
                  customAmount.trim() !== ""
                    ? "border-2 border-lime-deep bg-canvas"
                    : "border-stone-soft bg-canvas focus:border-ink"
                }`}
                aria-label="Custom tip amount in credits"
              />
              <span className="font-mono text-caption text-muted-on-light">Credits</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-tiny text-muted-on-light">
            Tips are instantly credited to the freelancer&apos;s available balance on Fairwork.
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !activeAmount || activeAmount <= 0}
            className="inline-flex items-center gap-2 rounded-tag border border-ink bg-ink px-5 py-2 font-mono text-caption font-medium text-canvas hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Spinner />
                <span>Processing Tip...</span>
              </>
            ) : (
              <span>
                Send Tip{" "}
                {activeAmount && activeAmount > 0 ? `(${formatCredits(activeAmount)})` : ""}
              </span>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
