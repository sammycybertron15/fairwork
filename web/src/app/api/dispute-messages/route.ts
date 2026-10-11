import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { getDisputeMessages, saveDisputeMessage } from "@/lib/db/blobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postMessageSchema = z.object({
  agreementId: z.string().min(1),
  milestoneIndex: z.number().int().min(0),
  senderAddress: z.string().min(1),
  senderRole: z.enum(["buyer", "freelancer", "resolver"]),
  message: z.string().min(1).max(5000),
});

export async function GET(request: NextRequest) {
  const agreementId = request.nextUrl.searchParams.get("agreementId");
  const milestoneIndexStr = request.nextUrl.searchParams.get("milestoneIndex");

  if (!agreementId || milestoneIndexStr === null) {
    return errorResponse(
      400,
      "missing_params",
      "agreementId and milestoneIndex query parameters are required",
    );
  }

  const milestoneIndex = parseInt(milestoneIndexStr, 10);
  if (!Number.isFinite(milestoneIndex)) {
    return errorResponse(400, "invalid_index", "milestoneIndex must be an integer");
  }

  const messages = getDisputeMessages(agreementId, milestoneIndex);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = postMessageSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_message",
      "Message must have valid agreementId, milestoneIndex, senderAddress, senderRole, and text",
    );
  }

  const saved = saveDisputeMessage({
    agreementId: parsed.data.agreementId,
    milestoneIndex: parsed.data.milestoneIndex,
    senderAddress: parsed.data.senderAddress,
    senderRole: parsed.data.senderRole,
    message: parsed.data.message.trim(),
  });

  return NextResponse.json({ message: saved }, { status: 201 });
}
