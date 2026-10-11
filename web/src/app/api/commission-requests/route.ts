import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { commissionRequestSchema, createCommissionRequest } from "@/lib/db/commissions";
import { getStorefront } from "@/lib/db/freelancers";

export const runtime = "nodejs";

/** POST /api/commission-requests. Unsigned and unverified: it is stored, never trusted. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Body must be valid JSON");
  }

  const parsed = commissionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_body",
      "A title, a description and a whole-number budget in credits are required",
    );
  }
  if (!getStorefront(parsed.data.handle)) {
    return errorResponse(404, "not_found", "No storefront with this handle");
  }

  const id = createCommissionRequest(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
