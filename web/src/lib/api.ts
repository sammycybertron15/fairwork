import { NextResponse } from "next/server";

/** The one error shape for every route: `{ error: { code, message } }` (spec 7.3). */
export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
