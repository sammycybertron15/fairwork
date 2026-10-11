import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCard } from "@/components/PackageCard";
import { PortfolioItemCard } from "@/components/PortfolioItemCard";
import { StorefrontClientHeader } from "@/components/StorefrontClientHeader";
import { CommissionForm } from "@/features/storefront/CommissionForm";
import { getStorefront } from "@/lib/db/freelancers";
import { shortHex } from "@/lib/format";

// Read per request: the seed script rewrites the database outside Next.
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const storefront = getStorefront(handle);
  return { title: storefront ? `${storefront.freelancer.name} · Fairwork` : "Fairwork" };
}

export default async function StorefrontPage({ params }: PageProps) {
  const { handle } = await params;
  const storefront = getStorefront(handle);
  if (!storefront) notFound();
  const { freelancer, portfolio, packages, reviews } = storefront;

  return (
    <div className="flex flex-col gap-16">
      <StorefrontClientHeader initialStorefront={storefront} />

      <section aria-labelledby="portfolio-heading">
        <h2 id="portfolio-heading" className="text-title font-medium text-ink">
          Featured Work & Portfolio
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.map((item, index) => (
            <li key={item.id}>
              <PortfolioItemCard item={item} dark={index % 2 === 1} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="packages-heading">
        <h2 id="packages-heading" className="text-title font-medium text-ink">
          Packages & Fixed Scopes
        </h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {packages.map((pkg) => (
            <li key={pkg.id}>
              <PackageCard pkg={pkg} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reviews-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="reviews-heading" className="text-title font-medium text-ink">
            Client Reviews & Reputation
          </h2>
          <span className="font-mono text-caption text-muted-on-light">
            ★ {storefront.reputation.rating.toFixed(1)} · {storefront.reputation.completedJobs}{" "}
            completed jobs
          </span>
        </div>

        {reviews.length === 0 ? (
          <p className="mt-6 text-caption text-muted-on-light">
            No reviews yet. Completed agreements with accepted deliverables earn verified on-chain
            client feedback.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-card border border-stone-soft bg-canvas p-5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-caption">
                  <div className="flex items-center gap-1 font-mono text-ink">
                    <span className="text-lime-deep">{"★".repeat(r.rating)}</span>
                    <span className="text-stone">{"★".repeat(Math.max(0, 5 - r.rating))}</span>
                    <span className="ml-1 font-semibold">{r.rating}.0</span>
                  </div>
                  <span className="font-mono text-muted-on-light">
                    {shortHex(r.reviewerAddress)}
                  </span>
                </div>
                <p className="text-body text-ink leading-relaxed mt-1">{r.comment}</p>
                <div className="mt-auto pt-2 flex items-center gap-2 text-caption text-muted-on-light border-t border-stone-soft/50">
                  <span aria-hidden className="inline-block size-1.5 bg-lime" />
                  <span>Verified Escrow Completion</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="commission-heading">
        <h2
          id="commission-heading"
          className="flex flex-wrap items-center gap-3 text-title font-medium text-ink"
        >
          Custom Commission Request
          <span className="rounded-tag border border-stone-soft px-2 font-sans text-caption text-muted-on-light">
            Unverified
          </span>
        </h2>
        <p className="mb-6 mt-2 max-w-measure text-muted-on-light">
          Describe something outside the packages. Requests are not signed, so {freelancer.name}{" "}
          cannot confirm who sent one, and nothing here moves credits.
        </p>
        <CommissionForm
          handle={freelancer.handle}
          name={freelancer.name}
          freelancerAddress={freelancer.address}
        />
      </section>
    </div>
  );
}
