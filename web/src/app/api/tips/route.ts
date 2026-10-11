import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { createTip, getTipsForAgreement, getTipsForFreelancer } from "@/lib/db/tips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tipSchema = z.object({
  agreementId: z.string().min(1),
  buyerAddress: z.string().min(1),
  freelancerAddress: z.string().min(1),
  amountCredits: z.number().int().min(1),
});

export async function GET(request: NextRequest) {
  const agreementId = request.nextUrl.searchParams.get("agreementId");
  const freelancerAddress = request.nextUrl.searchParams.get("freelancerAddress");

  if (agreementId) {
    const tips = getTipsForAgreement(agreementId);
    const totalTips = tips.reduce((acc, t) => acc + t.amountCredits, 0);
    return NextResponse.json({ tips, totalTips });
  }

  if (freelancerAddress) {
    const tips = getTipsForFreelancer(freelancerAddress);
    const totalTips = tips.reduce((acc, t) => acc + t.amountCredits, 0);
    return NextResponse.json({ tips, totalTips });
  }

  return errorResponse(
    400,
    "invalid_query",
    "Must provide agreementId or freelancerAddress parameter",
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = tipSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_tip",
      "Invalid tip parameters: agreementId, buyerAddress, freelancerAddress and amountCredits (> 0) required",
    );
  }

  const tip = createTip({
    agreementId: parsed.data.agreementId,
    buyerAddress: parsed.data.buyerAddress,
    freelancerAddress: parsed.data.freelancerAddress,
    amountCredits: parsed.data.amountCredits,
  });

  const tips = getTipsForAgreement(parsed.data.agreementId);
  const totalTips = tips.reduce((acc, t) => acc + t.amountCredits, 0);

  return NextResponse.json({ success: true, tip, totalTips }, { status: 201 });
}
