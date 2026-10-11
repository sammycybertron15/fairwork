import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERNAL_RPC = process.env.INTERNAL_RPC_URL ?? "http://127.0.0.1:8545";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const res = await fetch(INTERNAL_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message:
            error instanceof Error
              ? error.message
              : "Internal RPC error connecting to Hardhat node",
        },
      },
      { status: 502 },
    );
  }
}
