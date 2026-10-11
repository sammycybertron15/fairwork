import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { createReview, getReviewForAgreement, getReviewsForFreelancer } from "@/lib/db/freelancers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  agreementId: z.string().nullable().optional(),
  freelancerHandle: z.string().min(1),
  reviewerAddress: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});

export async function GET(request: NextRequest) {
  const agreementId = request.nextUrl.searchParams.get("agreementId");
  const handle = request.nextUrl.searchParams.get("handle");

  if (agreementId) {
    const review = getReviewForAgreement(agreementId);
    return NextResponse.json({ review: review ?? null });
  }

  if (handle) {
    const reviews = getReviewsForFreelancer(handle);
    return NextResponse.json({ reviews });
  }

  return errorResponse(400, "invalid_query", "Must provide agreementId or handle parameter");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_review",
      "Invalid review parameters: rating must be 1-5, comment non-empty",
    );
  }

  const review = createReview({
    agreementId: parsed.data.agreementId ?? null,
    freelancerHandle: parsed.data.freelancerHandle,
    reviewerAddress: parsed.data.reviewerAddress,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
  });

  return NextResponse.json({ review }, { status: 201 });
}
