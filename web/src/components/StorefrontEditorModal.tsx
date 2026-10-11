"use client";

import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import type { Storefront, StorefrontPackage } from "@/lib/db/freelancers";

type StorefrontEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  storefront: Storefront;
  onSuccess?: (updated: Storefront) => void;
};

export function StorefrontEditorModal({
  isOpen,
  onClose,
  storefront,
  onSuccess,
}: StorefrontEditorModalProps) {
  const toast = useToast();
  const [headline, setHeadline] = useState(storefront.freelancer.headline);
  const [bio, setBio] = useState(storefront.freelancer.bio);
  const [packages, setPackages] = useState<StorefrontPackage[]>(storefront.packages);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handlePackageChange(id: number, field: "priceCredits" | "deliveryDays", value: number) {
    setPackages((prev) => prev.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/freelancers/${storefront.freelancer.handle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline,
          bio,
          packages: packages.map((p) => ({
            id: p.id,
            priceCredits: Number(p.priceCredits),
            deliveryDays: Number(p.deliveryDays),
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || "Failed to update storefront profile");
      }

      const updated = (await res.json()) as Storefront;
      toast.success("Storefront profile and packages updated successfully");
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update storefront profile";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-none"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-panel border border-stone/30 bg-ink p-6 sm:p-8 text-canvas shadow-xl">
        <div className="flex items-start justify-between border-b border-stone/20 pb-4">
          <div>
            <h2 id="editor-modal-title" className="font-heading text-title font-medium text-canvas">
              Edit Profile & Packages
            </h2>
            <p className="mt-1 text-caption text-stone">
              Update your public storefront headline, bio, pricing and delivery commitments.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-tag border border-stone/30 p-1.5 text-stone hover:border-canvas hover:text-canvas"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-tag border border-danger/40 bg-danger/10 p-3 text-caption text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
          <div>
            <label htmlFor="edit-headline" className="block text-caption font-medium text-stone">
              Storefront Headline
            </label>
            <input
              id="edit-headline"
              type="text"
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1.5 w-full rounded-input border border-stone/30 bg-ink px-3 py-2 text-canvas focus:border-lime focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="edit-bio" className="block text-caption font-medium text-stone">
              Bio / Experience Summary
            </label>
            <textarea
              id="edit-bio"
              rows={4}
              required
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1.5 w-full rounded-input border border-stone/30 bg-ink px-3 py-2 text-canvas focus:border-lime focus:outline-none"
            />
          </div>

          <div>
            <h3 className="text-lead font-medium text-canvas">Package Pricing & Delivery Days</h3>
            <p className="mt-0.5 text-caption text-stone">
              Configure baseline credit rates and promised delivery turnaround per package.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-card border border-stone/20 bg-stone/5 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-canvas text-lead">{pkg.name}</span>
                    <span className="rounded-tag border border-stone/30 px-2 py-0.5 text-caption text-stone">
                      {pkg.revisions} {pkg.revisions === 1 ? "revision" : "revisions"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor={`pkg-${pkg.id}-credits`}
                        className="block text-caption text-stone"
                      >
                        Price (credits)
                      </label>
                      <input
                        id={`pkg-${pkg.id}-credits`}
                        type="number"
                        min="1"
                        required
                        value={pkg.priceCredits}
                        onChange={(e) =>
                          handlePackageChange(pkg.id, "priceCredits", parseInt(e.target.value, 10))
                        }
                        className="mt-1 w-full rounded-input border border-stone/30 bg-ink px-3 py-1.5 font-mono text-canvas focus:border-lime focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`pkg-${pkg.id}-days`}
                        className="block text-caption text-stone"
                      >
                        Delivery Days
                      </label>
                      <input
                        id={`pkg-${pkg.id}-days`}
                        type="number"
                        min="1"
                        required
                        value={pkg.deliveryDays}
                        onChange={(e) =>
                          handlePackageChange(pkg.id, "deliveryDays", parseInt(e.target.value, 10))
                        }
                        className="mt-1 w-full rounded-input border border-stone/30 bg-ink px-3 py-1.5 font-mono text-canvas focus:border-lime focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-stone/20 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-btn border border-stone/40 px-4 py-2 text-caption font-medium text-stone hover:text-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-btn bg-lime px-6 py-2 text-lead font-medium text-ink hover:bg-lime-deep transition-colors"
            >
              {isSubmitting && <Spinner className="size-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
