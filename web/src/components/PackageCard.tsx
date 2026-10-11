import Link from "next/link";
import type { StorefrontPackage } from "@/lib/db/freelancers";
import { formatCredits } from "@/lib/format";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function PackageCard({ pkg }: { pkg: StorefrontPackage }) {
  return (
    <article className="flex flex-col gap-4 rounded-card border border-stone-soft p-6">
      <div>
        <h3 className="text-lead">{pkg.name}</h3>
        <p className="mt-1 text-muted-on-light">{pkg.description}</p>
      </div>
      <p className="font-heading text-title font-medium">
        {formatCredits(BigInt(pkg.priceCredits))}
      </p>
      <p className="text-caption text-muted-on-light">
        Delivery in {plural(pkg.deliveryDays, "day")} · {plural(pkg.revisions, "revision")} included
      </p>
      <Link href={`/agreements/new?package=${pkg.id}`} className="btn-primary mt-auto">
        Start agreement
      </Link>
    </article>
  );
}
