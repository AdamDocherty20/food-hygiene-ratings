import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/establishments/[id]
 *
 * [id] is the FSA's stable fhrsId (not our internal database id).
 * Returns 404 if no establishment with that fhrsId exists, or if it exists but
 * isActive is false (i.e. it's dropped out of the FSA feed).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const fhrsId = Number(id);
  if (!Number.isInteger(fhrsId)) {
    return jsonError(400, `Invalid establishment id: "${id}". Must be an integer (fhrsId).`);
  }

  try {
    const establishment = await prisma.establishment.findFirst({
      where: { fhrsId, isActive: true },
    });

    if (!establishment) {
      return jsonError(404, `No active establishment found with fhrsId ${fhrsId}.`);
    }

    return NextResponse.json({ data: establishment });
  } catch (err) {
    console.error(`GET /api/establishments/${id} failed:`, err);
    return jsonError(500, "Internal server error while fetching establishment.");
  }
}
