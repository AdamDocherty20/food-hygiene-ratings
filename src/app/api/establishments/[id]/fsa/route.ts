import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { fetchFsaEstablishmentDetail } from "@/lib/fsa-api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/establishments/[id]/fsa
 *
 * The establishment page renders its core content (name, address, rating, history) fully
 * server-rendered from our own database — see src/lib/establishment-detail.ts. This route
 * exists only for the extras that come from a live call to the FSA's own per-establishment
 * API (phone, right-to-reply, score breakdown, new-rating-pending), which can be slow or
 * fail and shouldn't hold up rendering the rest of the page, so the client fetches it
 * separately after the main content is already visible.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const { id } = await params;

  const fhrsId = Number(id);
  if (!Number.isInteger(fhrsId)) {
    return jsonError(400, `Invalid establishment id: "${id}". Must be an integer (fhrsId).`);
  }

  try {
    const fsaDetail = await fetchFsaEstablishmentDetail(fhrsId);
    return NextResponse.json({ fsaDetail });
  } catch (err) {
    console.error(`GET /api/establishments/${id}/fsa failed:`, err);
    return jsonError(500, "Internal server error while fetching FSA detail.");
  }
}
