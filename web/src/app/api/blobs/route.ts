import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { errorResponse } from "@/lib/api";
import { MAX_BLOB_BYTES, putBlob, putBlobBodySchema } from "@/lib/db/blobs";

export const runtime = "nodejs";

/** PUT /api/blobs { kind, json } -> { hash }. Content-addressed, so no auth is needed. */
export async function PUT(request: NextRequest) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BLOB_BYTES * 2) {
    return errorResponse(413, "too_large", "Request body is too large");
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse(400, "invalid_json", "Body must be valid JSON");
  }

  const parsed = putBlobBodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_body", "Expected { kind, json } with json an object");
  }

  try {
    return NextResponse.json({ hash: putBlob(parsed.data.kind, parsed.data.json) });
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(400, "invalid_terms", "Terms do not match the terms schema");
    }
    if (error instanceof RangeError) return errorResponse(413, "too_large", error.message);
    throw error;
  }
}
