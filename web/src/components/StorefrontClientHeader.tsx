"use client";

import { useState } from "react";
import { usePersona } from "@/lib/demo/persona-context";
import { CopyButton } from "@/components/CopyButton";
import { StorefrontEditorModal } from "@/components/StorefrontEditorModal";
import type { Storefront } from "@/lib/db/freelancers";
import { shortHex } from "@/lib/format";
import { createDeterministicAvatar } from "@/lib/visuals";

export function StorefrontClientHeader({ initialStorefront }: { initialStorefront: Storefront }) {
  const { address } = usePersona();
  const [storefront, setStorefront] = useState<Storefront>(initialStorefront);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { freelancer, reputation } = storefront;
  const isOwner =
    address && freelancer.address && address.toLowerCase() === freelancer.address.toLowerCase();

  const fallbackAvatar = createDeterministicAvatar(freelancer.name, freelancer.handle);
  const [avatarSrc, setAvatarSrc] = useState(freelancer.avatarUrl || fallbackAvatar);

  return (
    <>
      <header className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {/* Avatar thumbnail */}
            <div className="relative size-20 shrink-0 overflow-hidden rounded-card border border-stone-soft bg-ink shadow-sm">
              <img
                src={avatarSrc}
                alt={freelancer.name}
                onError={() => setAvatarSrc(fallbackAvatar)}
                className="size-full object-cover"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-display font-medium text-ink">{freelancer.name}</h1>
                <span className="font-mono text-lead text-muted-on-light">
                  @{freelancer.handle}
                </span>
              </div>
              <p className="mt-1 text-lead text-muted-on-light max-w-measure">
                {freelancer.headline}
              </p>

              {/* Reputation & Trust Badges */}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {/* Star rating badge */}
                <div className="inline-flex items-center gap-1.5 rounded-tag border border-stone-soft bg-stone/10 px-2.5 py-1 text-caption font-medium text-ink">
                  <span className="text-lime-deep font-bold">★</span>
                  <span className="font-mono font-semibold">{reputation.rating.toFixed(1)}</span>
                  <span className="text-muted-on-light font-sans font-normal">
                    ({reputation.completedJobs} completed jobs)
                  </span>
                </div>

                {/* Trust Badges matching spec tokens: 8px square marker + 2px radius tag */}
                {reputation.trustBadges.map((badge, idx) => (
                  <div
                    key={badge}
                    className="inline-flex items-center gap-1.5 rounded-tag border border-stone-soft bg-canvas px-2.5 py-1 text-caption text-ink font-sans"
                  >
                    <span
                      aria-hidden
                      className={`inline-block size-2 ${idx === 2 ? "bg-lime-deep" : "bg-lime"}`}
                    />
                    <span>{badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Owner Action Button */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-btn border border-lime-deep bg-lime/10 px-4 py-2 font-medium text-ink transition-colors hover:bg-lime hover:text-ink shadow-sm"
            >
              <span>✎</span> Edit Profile & Packages
            </button>
          )}
        </div>

        <div className="max-w-measure">
          <p className="text-body leading-relaxed text-ink">{freelancer.bio}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-caption text-muted-on-light">
            <span className="font-medium text-ink">On-Chain Wallet:</span>
            <span className="font-mono" title={freelancer.address}>
              {shortHex(freelancer.address)}
            </span>
            <CopyButton value={freelancer.address} label="Copy wallet address" />
          </div>
        </div>
      </header>

      <StorefrontEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        storefront={storefront}
        onSuccess={(updated) => setStorefront(updated)}
      />
    </>
  );
}
