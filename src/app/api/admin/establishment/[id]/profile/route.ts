import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// Auth via proxy.ts's /api/admin/* matcher. Upserts BusinessProfile wholesale (not a
// partial patch) — the admin editor always submits the full current state of the form,
// including the current photoUrls array, so a plain replace is correct and simpler than
// diffing.
const ProfileSchema = z.object({
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  website: z.string().trim().max(500).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  photoUrls: z.array(z.string().url()).max(20),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fhrsId = Number(id);
  if (!Number.isInteger(fhrsId)) {
    return jsonError(400, `Invalid establishment id: "${id}".`);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid profile data.");
  }

  try {
    const establishment = await prisma.establishment.findFirst({ where: { fhrsId, isActive: true }, select: { fhrsId: true } });
    if (!establishment) {
      return jsonError(404, `No active establishment found with fhrsId ${fhrsId}.`);
    }

    const { description, website, phone, photoUrls } = parsed.data;
    const data = {
      description: description || null,
      website: website || null,
      phone: phone || null,
      photoUrls,
    };

    const profile = await prisma.businessProfile.upsert({
      where: { fhrsId },
      create: { fhrsId, ...data },
      update: data,
    });

    return NextResponse.json({ data: profile });
  } catch (err) {
    console.error(`POST /api/admin/establishment/${id}/profile failed:`, err);
    return jsonError(500, "Internal server error while saving the profile.");
  }
}
