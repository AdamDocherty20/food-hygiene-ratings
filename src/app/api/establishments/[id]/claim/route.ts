import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

// The first mutation route in this app (every other route is GET) — see the claim
// feature's design notes: nothing here is exposed to end users beyond "your claim was
// submitted"; review and approval is entirely manual via the password-gated /admin/claims
// page, so this route's job is just to validate, store, and stay cheap to abuse.
const ClaimSchema = z.object({
  claimantName: z.string().trim().min(1, "Name is required.").max(200),
  claimantEmail: z.string().trim().email("Enter a valid email address.").max(320),
  claimantPhone: z.string().trim().max(50).optional().or(z.literal("")),
  relationship: z.string().trim().min(1, "Select how you're connected to this business.").max(100),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot: a real visitor never sees or fills this field (hidden via CSS on the form),
  // so anything in it means a bot filled every field blindly — reject without a DB write,
  // no captcha/rate-limit-service dependency needed for this alone.
  website: z.string().max(0, "").optional().or(z.literal("")),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const { id } = await params;
  const fhrsId = Number(id);
  if (!Number.isInteger(fhrsId)) {
    return jsonError(400, `Invalid establishment id: "${id}". Must be an integer (fhrsId).`);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid claim submission.");
  }

  const { website: honeypot, claimantPhone, message, ...rest } = parsed.data;
  if (honeypot) {
    // Silently accept (200) rather than 400/403 — telling a bot its honeypot was
    // detected only teaches it to avoid that field next time.
    return NextResponse.json({ ok: true });
  }

  try {
    const establishment = await prisma.establishment.findFirst({
      where: { fhrsId, isActive: true },
      select: { fhrsId: true },
    });
    if (!establishment) {
      return jsonError(404, `No active establishment found with fhrsId ${fhrsId}.`);
    }

    await prisma.businessClaim.create({
      data: {
        fhrsId,
        ...rest,
        claimantPhone: claimantPhone || null,
        message: message || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`POST /api/establishments/${id}/claim failed:`, err);
    return jsonError(500, "Internal server error while submitting your claim.");
  }
}
