"use client";

import { useState } from "react";
import type { PortfolioItem } from "@/lib/db/freelancers";
import { createDeterministicSvgThumbnail } from "@/lib/visuals";

export function PortfolioItemCard({ item }: { item: PortfolioItem; dark?: boolean }) {
  const fallbackSvg = createDeterministicSvgThumbnail(item.title, item.tag);
  const [imageSrc, setImageSrc] = useState<string>(item.imageUrl || fallbackSvg);

  return (
    <article className="flex flex-col gap-3 group">
      <div className="relative h-48 w-full overflow-hidden rounded-card border border-stone-soft bg-ink">
        <img
          src={imageSrc}
          alt={item.title}
          onError={() => setImageSrc(fallbackSvg)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute bottom-2 left-2">
          <span className="rounded-tag border border-stone/30 bg-ink/90 px-2.5 py-0.5 font-sans text-caption font-medium text-stone">
            {item.tag}
          </span>
        </div>
      </div>
      <div>
        <h3 className="text-lead font-medium text-ink">{item.title}</h3>
        <p className="mt-1 text-caption text-muted-on-light leading-relaxed">{item.description}</p>
      </div>
    </article>
  );
}
