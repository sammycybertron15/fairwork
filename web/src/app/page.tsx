import { RoleSelectModal } from "@/components/RoleSelectModal";
import { StorefrontCard } from "@/components/StorefrontCard";
import { listStorefronts } from "@/lib/db/freelancers";

// Read per request: the seed script rewrites the database outside Next.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const storefronts = listStorefronts();

  return (
    <div className="flex flex-col gap-16">
      <RoleSelectModal />
      <section className="max-w-measure">
        <h1 className="text-display">Fairwork</h1>
        <p className="mt-4 text-lead text-muted-on-light">
          Get paid for what you deliver. Milestone-based freelance agreements with
          blockchain-enforced accounting.
        </p>
        <p className="mt-4 text-muted-on-light">
          Storefronts can be viewed without a wallet. Connect one from the header to start an
          agreement.
        </p>
      </section>

      <section aria-labelledby="storefronts-heading">
        <h2 id="storefronts-heading" className="text-title">
          Demo storefronts
        </h2>
        {storefronts.length === 0 ? (
          <p className="mt-6 text-muted-on-light">
            No storefronts yet. Run <code className="font-mono">npm run seed</code> to create them.
          </p>
        ) : (
          <ul className="mt-6 grid gap-6 md:grid-cols-3">
            {storefronts.map((storefront) => (
              <li key={storefront.handle}>
                <StorefrontCard storefront={storefront} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
