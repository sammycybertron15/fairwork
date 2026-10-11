import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getPackageWithFreelancer, listStorefronts } from "@/lib/db/freelancers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/freelancers: the demo storefront summaries.
 * GET /api/freelancers?package=<id>: look up one package with its freelancer address (for prefill).
 */
export function GET(request: NextRequest) {
  const packageId = request.nextUrl.searchParams.get("package");
  if (packageId !== null) {
    const id = parseInt(packageId, 10);
    if (!Number.isFinite(id))
      return errorResponse(400, "invalid_id", "Package id must be an integer");
    const pkg = getPackageWithFreelancer(id);
    if (!pkg) return errorResponse(404, "not_found", "No package with this id");
    return NextResponse.json({ package: pkg });
  }
  return NextResponse.json({ freelancers: listStorefronts() });
}
