import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { getBlob } from "@/lib/db/blobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/blobs/[hash]. The client must re-hash the JSON; the server is not trusted. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return errorResponse(400, "invalid_hash", "Hash must be 0x followed by 64 hex characters");
  }
  const blob = getBlob(hash);
  if (!blob) return errorResponse(404, "not_found", "No blob stored under this hash");
  return NextResponse.json(blob);
}
