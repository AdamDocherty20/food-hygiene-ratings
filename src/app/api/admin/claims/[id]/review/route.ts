import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// Auth is enforced entirely by proxy.ts for the /api/admin/* prefix — this route trusts
// that it only ever runs for an already-authenticated request. No rate limiting here
// (unlike the public routes): this is an internal, password-gated action, not something
// an outside party can reach at all.
const ReviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claimId = Number(id);
  if (!Number.isInteger(claimId)) {
    return jsonError(400, `Invalid claim id: "${id}".`);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'Body must be { "status": "approved" | "rejected" }.');

  try {
    const claim = await prisma.businessClaim.update({
      where: { id: claimId },
      data: { status: parsed.data.status, reviewedAt: new Date() },
    });
    return NextResponse.json({ data: claim });
  } catch (err) {
    console.error(`POST /api/admin/claims/${id}/review failed:`, err);
    return jsonError(500, "Internal server error while reviewing the claim.");
  }
}
