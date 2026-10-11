"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import type { Review } from "@/lib/db/freelancers";

type BuyerReviewBoxProps = {
  agreementId: string | bigint;
  freelancerAddress: string;
  buyerAddress: string;
};

export function BuyerReviewBox({
  agreementId,
  freelancerAddress,
  buyerAddress,
}: BuyerReviewBoxProps) {
  const strAgreementId = String(agreementId);
  const toast = useToast();
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadReview() {
      try {
        const res = await fetch(`/api/reviews?agreementId=${encodeURIComponent(strAgreementId)}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.review) {
            setExistingReview(data.review);
          }
        }
      } catch {
        // Fallback silently if offline
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadReview();
    return () => {
      mounted = false;
    };
  }, [agreementId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Please provide written feedback for the freelancer.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Look up freelancer handle by address
      let targetHandle = "alexdesign";
      const flRes = await fetch("/api/freelancers");
      if (flRes.ok) {
        const flData = await flRes.json();
        const match = flData.freelancers?.find(
          (f: { address?: string; handle?: string }) =>
            f.address?.toLowerCase() === freelancerAddress.toLowerCase(),
        );
        if (match?.handle) {
          targetHandle = match.handle;
        }
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId: strAgreementId,
          freelancerHandle: targetHandle,
          reviewerAddress: buyerAddress,
          rating,
          comment: comment.trim(),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error?.message || "Failed to submit review");
      }

      const saved = await res.json();
      setExistingReview(saved.review);
      toast.success("Review submitted successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit review";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-card border border-stone-soft bg-canvas p-6 text-caption text-muted-on-light animate-pulse">
        Checking review status...
      </div>
    );
  }

  if (existingReview) {
    return (
      <section
        aria-labelledby="review-published-heading"
        className="rounded-card border border-lime-deep/40 bg-canvas p-6 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="review-published-heading" className="text-lead font-medium text-ink">
            Your Review for this Project
          </h2>
          <div className="inline-flex items-center gap-1.5 rounded-tag border border-stone-soft bg-stone/10 px-2.5 py-1 text-caption text-ink font-mono font-medium">
            <span className="text-lime-deep">{"★".repeat(existingReview.rating)}</span>
            <span className="text-stone">{"★".repeat(Math.max(0, 5 - existingReview.rating))}</span>
            <span className="ml-1 font-semibold">{existingReview.rating}.0 / 5.0</span>
          </div>
        </div>

        <p className="text-body text-ink leading-relaxed">{existingReview.comment}</p>

        <div className="mt-2 pt-3 flex items-center gap-2 border-t border-stone-soft/60 text-caption text-muted-on-light">
          <span aria-hidden className="inline-block size-2 bg-lime" />
          <span>Verified Buyer Review · Persisted to Freelancer Reputation</span>
        </div>
      </section>
    );
  }

  const activeStars = hoverRating ?? rating;

  return (
    <section
      aria-labelledby="leave-review-heading"
      className="rounded-card border border-stone-soft bg-canvas p-6 flex flex-col gap-4 shadow-sm"
    >
      <div>
        <h2 id="leave-review-heading" className="text-lead font-medium text-ink">
          Leave a Review for the Freelancer
        </h2>
        <p className="mt-1 text-caption text-muted-on-light">
          All milestones are accepted or settled. Your review updates the freelancer&apos;s verified
          reputation across the marketplace.
        </p>
      </div>

      {error && (
        <div className="rounded-tag border border-danger/30 bg-danger/10 p-3 text-caption text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Star Rating Selector */}
        <div>
          <label className="block text-caption font-medium text-ink mb-1.5">
            Rating (1 to 5 Stars)
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => setRating(star)}
                className="text-2xl transition-colors focus:outline-none"
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                <span className={star <= activeStars ? "text-lime-deep" : "text-stone"}>★</span>
              </button>
            ))}
            <span className="ml-2 font-mono text-caption font-semibold text-ink">
              {activeStars}.0 / 5.0
            </span>
          </div>
        </div>

        {/* Feedback Textarea */}
        <div>
          <label
            htmlFor="review-feedback"
            className="block text-caption font-medium text-ink mb-1.5"
          >
            Feedback & Delivery Summary
          </label>
          <textarea
            id="review-feedback"
            rows={3}
            required
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share feedback on deliverable quality, adherence to specifications, and communication..."
            className="w-full rounded-input border border-stone-soft bg-canvas px-3 py-2 text-ink placeholder:text-muted-on-light focus:border-lime-deep focus:outline-none text-caption leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-btn bg-lime px-6 py-2 text-lead font-medium text-ink hover:bg-lime-deep transition-colors shadow-sm"
          >
            {isSubmitting && <Spinner className="size-4" />}
            Submit Review
          </button>
        </div>
      </form>
    </section>
  );
}
