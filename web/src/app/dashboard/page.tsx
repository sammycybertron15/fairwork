"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, usePublicClient } from "wagmi";
import { usePersona } from "@/lib/demo/persona-context";
import { CopyButton } from "@/components/CopyButton";
import { formatCredits, shortHex } from "@/lib/format";
import { useAvailableOf } from "@/lib/chain/hooks";
import { fetchAllAgreementsWithMilestones } from "@/lib/chain/events";
import {
  calculateMetrics,
  filterAgreementsByRole,
  getActiveDisputes,
  getAgreementProgress,
  type AgreementWithMilestones,
} from "@/lib/selectors";
import { StorefrontEditorModal } from "@/components/StorefrontEditorModal";
import type { Storefront } from "@/lib/db/freelancers";

function StatusMarker({ status }: { status: string }) {
  let cls = "border border-stone";
  if (
    status === "Active" ||
    status === "Funded" ||
    status === "Submitted" ||
    status === "RevisionRequested"
  ) {
    cls = "bg-lime-deep";
  } else if (status === "Completed" || status === "Accepted" || status === "Resolved") {
    cls = "bg-lime";
  } else if (status === "Disputed") {
    cls = "bg-danger";
  } else if (status === "Cancelled" || status === "Refunded") {
    cls = "bg-stone";
  }
  return <span aria-hidden className={`inline-block size-2 ${cls}`} />;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, persona, isInjected } = usePersona();
  const { isConnected: isWagmiConnected } = useAccount();
  const isConnected = isInjected ? isWagmiConnected : Boolean(address);
  const publicClient = usePublicClient();
  const [, startTransition] = useTransition();

  const [allAgreements, setAllAgreements] = useState<AgreementWithMilestones[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view: "buyer" | "freelancer"
  const viewParam = searchParams.get("view");
  const activeView: "buyer" | "freelancer" =
    viewParam === "freelancer" || (!viewParam && persona.role === "freelancer")
      ? "freelancer"
      : "buyer";

  const { data: availableCredits } = useAvailableOf(address);

  const [editorStorefront, setEditorStorefront] = useState<Storefront | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const freelancerHandle =
    persona.handle ??
    (() => {
      if (!address) return "leoncreative";
      const addr = address.toLowerCase();
      if (addr === "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc") return "ian-chii";
      if (addr === "0x90f79bf6eb2c4f870365e785982e1f101e93b906") return "sammydesign";
      return "leoncreative";
    })();

  async function handleOpenEditor() {
    try {
      const res = await fetch(`/api/freelancers/${freelancerHandle}`);
      if (res.ok) {
        const data = await res.json();
        setEditorStorefront(data);
        setIsEditorOpen(true);
      }
    } catch {
      //
    }
  }

  // Load agreements from chain
  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    async function loadData() {
      if (!publicClient) return;
      try {
        const items = await fetchAllAgreementsWithMilestones(publicClient);
        if (!cancelled) {
          setAllAgreements(items);
        }
      } catch {
        if (!cancelled) setAllAgreements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  function setView(view: "buyer" | "freelancer") {
    startTransition(() => {
      router.push(`/dashboard?view=${view}`);
    });
  }

  const roleAgreements = filterAgreementsByRole(allAgreements, address, activeView);
  const metrics = calculateMetrics(activeView, availableCredits ?? 0n, roleAgreements);
  const activeDisputes = getActiveDisputes(roleAgreements, activeView);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-title">Dashboard</h1>
          <p className="mt-1 text-muted-on-light text-caption">
            Closed-ledger credit accounting and agreement lifecycle tracking.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Dashboard role view"
          className="flex items-center rounded-card border border-stone-soft bg-canvas p-1"
        >
          <button
            role="tab"
            aria-selected={activeView === "buyer"}
            type="button"
            className={`rounded-tag px-4 py-1.5 text-caption font-medium transition-colors ${
              activeView === "buyer"
                ? "bg-ink text-canvas shadow-sm"
                : "text-muted-on-light hover:text-ink"
            }`}
            onClick={() => setView("buyer")}
          >
            Buyer View
          </button>
          <button
            role="tab"
            aria-selected={activeView === "freelancer"}
            type="button"
            className={`rounded-tag px-4 py-1.5 text-caption font-medium transition-colors ${
              activeView === "freelancer"
                ? "bg-ink text-canvas shadow-sm"
                : "text-muted-on-light hover:text-ink"
            }`}
            onClick={() => setView("freelancer")}
          >
            Freelancer View
          </button>
        </div>
      </div>

      {/* Freelancer Profile/Workspace Banner */}
      {activeView === "freelancer" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-lime/30 bg-ink p-5 text-caption text-canvas">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block size-2 bg-lime shrink-0" />
            <div>
              <p className="font-heading font-medium text-lead text-lime">Freelancer Workspace</p>
              <p className="text-stone">
                You are viewing agreements, deliverable deadlines, and earnings for your freelance
                persona.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleOpenEditor}
              className="rounded-card border border-stone/40 bg-stone/10 px-3 py-1.5 font-medium text-canvas transition-colors hover:border-lime hover:text-lime"
            >
              ✎ Edit Profile & Packages
            </button>
            <Link
              href={`/f/${freelancerHandle}`}
              className="rounded-card border border-lime bg-transparent px-3 py-1.5 font-medium text-lime transition-colors hover:bg-lime hover:text-ink"
            >
              View Public Storefront →
            </Link>
          </div>
        </div>
      )}

      {/* Disconnected State Prompt */}
      {!isConnected && (
        <div className="rounded-card border border-stone-soft p-6 bg-canvas text-caption">
          <p className="font-medium text-ink">Wallet Not Connected</p>
          <p className="mt-1 text-muted-on-light max-w-measure">
            Connect your wallet to view on-chain credit balances, agreements, escrow states, and
            active disputes.
          </p>
        </div>
      )}

      {/* Main Dark Container (spec 8.4: --ink background, 8px radius) */}
      <div className="rounded-panel bg-ink p-6 sm:p-8 text-canvas flex flex-col gap-8 shadow-md">
        {/* Container Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone/20 pb-4">
          <div>
            <span className="text-[0.75rem] font-mono uppercase tracking-wider text-stone">
              Account Overview · {activeView === "buyer" ? "Buyer Account" : "Freelancer Account"}
            </span>
            {address && (
              <div className="mt-1 flex items-center gap-2 font-mono text-caption text-stone">
                <span>{shortHex(address, 6, 6)}</span>
                <CopyButton value={address} label="Copy connected address" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone text-[0.8rem]">Chain: Hardhat Local (31337)</span>
          </div>
        </div>

        {/* Financial Metric Row with Vivid Lime Highlights (spec 8.4) */}
        <section aria-label="Financial Metrics" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse flex-col gap-2 rounded-card border border-stone/20 bg-ink/70 p-4"
                >
                  <div className="h-3 w-20 rounded bg-stone/20" />
                  <div className="h-8 w-24 rounded bg-lime/20" />
                  <div className="h-2.5 w-16 rounded bg-stone/20" />
                </div>
              ))}
            </>
          ) : (
            <>
              {/* 1. Available Credits */}
              <div className="flex flex-col gap-1 rounded-card border border-stone/20 bg-ink p-4">
                <span className="text-[0.75rem] text-stone">Available Balance</span>
                <span className="font-heading text-title font-medium text-lime">
                  {formatCredits(metrics.availableCredits)}
                </span>
                <span className="text-[0.75rem] text-stone">Free to allocate</span>
              </div>

              {/* 2. Locked in Escrow */}
              <div className="flex flex-col gap-1 rounded-card border border-stone/20 bg-ink p-4">
                <span className="text-[0.75rem] text-stone">Locked in Escrow</span>
                <span className="font-heading text-title font-medium text-canvas">
                  {formatCredits(metrics.lockedCredits)}
                </span>
                <span className="text-[0.75rem] text-stone">In active milestones</span>
              </div>

              {/* 3. Released Credits */}
              <div className="flex flex-col gap-1 rounded-card border border-stone/20 bg-ink p-4">
                <span className="text-[0.75rem] text-stone">
                  {activeView === "buyer" ? "Released to Freelancers" : "Earned & Released"}
                </span>
                <span className="font-heading text-title font-medium text-lime">
                  {formatCredits(metrics.releasedCredits)}
                </span>
                <span className="text-[0.75rem] text-stone">Completed milestones</span>
              </div>

              {/* 4. Refunded Credits */}
              <div className="flex flex-col gap-1 rounded-card border border-stone/20 bg-ink p-4">
                <span className="text-[0.75rem] text-stone">Refunded Credits</span>
                <span className="font-heading text-title font-medium text-canvas">
                  {formatCredits(metrics.refundedCredits)}
                </span>
                <span className="text-[0.75rem] text-stone">Returned from disputes/timeouts</span>
              </div>
            </>
          )}
        </section>

        {/* Active Disputes Section (highlighted if any) */}
        {activeDisputes.length > 0 && (
          <section
            aria-labelledby="disputes-heading"
            className="flex flex-col gap-3 rounded-card border border-danger/40 bg-danger/10 p-5"
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className="inline-block size-2.5 bg-danger" />
              <h2 id="disputes-heading" className="font-heading text-body font-medium text-danger">
                Active Disputes ({activeDisputes.length})
              </h2>
            </div>
            <p className="text-[0.8rem] text-stone">
              The following milestones are currently disputed and locked in escrow pending resolver
              settlement:
            </p>

            <div className="flex flex-col gap-2 mt-1">
              {activeDisputes.map((disp, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-tag border border-danger/30 bg-ink p-3 text-caption"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-canvas">
                      Agreement #{disp.agreementId.toString()} · Milestone {disp.milestoneIndex + 1}
                    </span>
                    <span className="font-medium text-danger">
                      {formatCredits(disp.milestoneCredits)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[0.75rem] text-stone font-mono">
                      Counterparty: {shortHex(disp.counterpartyAddress)}
                    </span>
                    <Link
                      href={`/agreements/${disp.agreementId.toString()}`}
                      className="text-[0.8rem] text-lime hover:underline"
                    >
                      View dispute →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Agreements Table */}
        <section aria-labelledby="agreements-table-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="agreements-table-heading" className="text-lead font-medium text-canvas">
              {activeView === "buyer" ? "Your Purchased Agreements" : "Your Freelance Agreements"}
            </h2>
            <Link href="/" className="text-caption text-lime hover:underline">
              Browse storefronts →
            </Link>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2 rounded-card border border-stone/20 p-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center justify-between border-b border-stone/10 py-3 last:border-0"
                >
                  <div className="h-4 w-12 rounded bg-stone/20" />
                  <div className="h-4 w-20 rounded bg-stone/20" />
                  <div className="h-4 w-28 rounded bg-stone/20" />
                  <div className="h-4 w-16 rounded bg-lime/20" />
                </div>
              ))}
            </div>
          ) : roleAgreements.length === 0 ? (
            <div className="rounded-card border border-stone/20 p-8 text-center text-caption text-stone">
              <p>No agreements found for this account in the {activeView} role.</p>
              <div className="mt-3">
                <Link
                  href="/"
                  className="inline-block rounded-card bg-lime px-4 py-2 font-medium text-ink hover:opacity-90"
                >
                  Browse creators to start an agreement
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-card border border-stone/20">
              <table className="w-full text-left text-caption">
                <thead className="border-b border-stone/20 bg-stone/5 font-medium text-stone">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">{activeView === "buyer" ? "Freelancer" : "Buyer"}</th>
                    <th className="p-3">Progress</th>
                    <th className="p-3">Total Value</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone/10">
                  {roleAgreements.map((item) => {
                    const progress = getAgreementProgress(item.milestones);
                    const counterparty =
                      activeView === "buyer" ? item.agreement.freelancer : item.agreement.buyer;

                    return (
                      <tr key={item.id.toString()} className="hover:bg-stone/5">
                        <td className="p-3 font-medium text-canvas font-mono">
                          #{item.id.toString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <StatusMarker status={item.agreement.status} />
                            <span>{item.agreement.status}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-stone">
                          <div className="flex items-center gap-1.5">
                            <span>{shortHex(counterparty)}</span>
                            <CopyButton value={counterparty} label="Copy address" />
                          </div>
                        </td>
                        <td className="p-3 text-stone">{progress.summary}</td>
                        <td className="p-3 font-medium text-canvas">
                          {formatCredits(progress.totalCredits)}
                        </td>
                        <td className="p-3 text-right">
                          <Link
                            href={`/agreements/${item.id.toString()}`}
                            className="text-lime hover:underline font-medium"
                          >
                            Details →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {editorStorefront && (
        <StorefrontEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          storefront={editorStorefront}
          onSuccess={(updated) => setEditorStorefront(updated)}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-panel border border-stone/20 bg-ink p-8 text-caption text-stone">
          Loading dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
