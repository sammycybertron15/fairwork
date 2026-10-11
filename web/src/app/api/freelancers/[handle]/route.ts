import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { getStorefront, updateStorefrontProfile } from "@/lib/db/freelancers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  headline: z.string().min(1).optional(),
  bio: z.string().min(1).optional(),
  packages: z
    .array(
      z.object({
        id: z.number().int(),
        priceCredits: z.number().int().min(1),
        deliveryDays: z.number().int().min(1),
      }),
    )
    .optional(),
});

/** GET /api/freelancers/[handle]: profile, portfolio, packages and reviews. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const storefront = getStorefront(handle);
  if (!storefront) return errorResponse(404, "not_found", "No storefront with this handle");
  return NextResponse.json(storefront);
}

/** PATCH /api/freelancers/[handle]: update bio, headline, package prices and delivery days. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const existing = getStorefront(handle);
  if (!existing) return errorResponse(404, "not_found", "No storefront with this handle");

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_update", "Invalid storefront update parameters");
  }

  updateStorefrontProfile(handle, parsed.data);
  const updated = getStorefront(handle);
  return NextResponse.json(updated);
}
