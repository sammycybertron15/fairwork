"use client";

import Link from "next/link";
import { useState } from "react";
import type { StorefrontSummary } from "@/lib/db/freelancers";
import { formatCredits } from "@/lib/format";
import { createDeterministicAvatar, createDeterministicSvgThumbnail } from "@/lib/visuals";

export function StorefrontCard({ storefront }: { storefront: StorefrontSummary }) {
  const fallbackAvatar = createDeterministicAvatar(storefront.name, storefront.handle);
  const [avatarSrc, setAvatarSrc] = useState<string>(storefront.avatarUrl || fallbackAvatar);

  const previewThumbnail =
    storefront.previewImages && storefront.previewImages.length > 0
      ? storefront.previewImages[0]
      : createDeterministicSvgThumbnail(storefront.name, "Design");
  const [thumbSrc, setThumbSrc] = useState<string>(previewThumbnail);

  return (
    <Link
      href={`/f/${storefront.handle}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-stone-soft bg-canvas transition-all hover:border-lime-deep hover:shadow-sm"
    >
      {/* Project Preview Thumbnail Banner */}
      <div className="relative h-36 w-full overflow-hidden bg-ink">
        <img
          src={thumbSrc}
          alt={storefront.headline}
          onError={() => setThumbSrc(createDeterministicSvgThumbnail(storefront.name, "Preview"))}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute right-3 top-3">
          <span className="rounded-tag border border-stone/30 bg-ink/90 px-2 py-0.5 font-mono text-caption font-semibold text-lime">
            From {formatCredits(BigInt(storefront.fromCredits))}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative size-12 shrink-0 overflow-hidden rounded-card border border-stone-soft bg-ink">
            <img
              src={avatarSrc}
              alt={storefront.name}
              onError={() => setAvatarSrc(fallbackAvatar)}
              className="size-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <h3 className="font-heading text-lead font-medium text-ink group-hover:text-lime-deep">
              {storefront.name}
            </h3>
            <span className="font-mono text-caption text-muted-on-light">@{storefront.handle}</span>
          </div>
        </div>

        <p className="mt-3 text-caption text-muted-on-light line-clamp-2 leading-relaxed">
          {storefront.headline}
        </p>

        {/* Reputation & Trust Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-tag border border-stone-soft bg-stone/10 px-2 py-0.5 font-mono text-caption font-medium text-ink">
            <span className="text-lime-deep">★</span> {storefront.reputation.rating.toFixed(1)}
            <span className="text-muted-on-light font-sans font-normal">
              ({storefront.reputation.completedJobs} jobs)
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-tag border border-stone-soft bg-stone/5 px-2 py-0.5 text-caption text-muted-on-light font-sans">
            <span aria-hidden className="inline-block size-1.5 bg-lime" />
            100% Completion
          </span>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-stone-soft text-caption">
          <span className="text-muted-on-light">{storefront.packageCount} packages</span>
          <span className="font-medium text-ink underline underline-offset-4 group-hover:text-lime-deep">
            View storefront →
          </span>
        </div>
      </div>
    </Link>
  );
}
