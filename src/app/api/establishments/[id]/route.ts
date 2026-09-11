import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { getEstablishmentDetailData } from "@/lib/establishment-detail";
import { fetchFsaEstablishmentDetail } from "@/lib/fsa-api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/establishments/[id]
 *
 * [id] is the FSA's stable fhrsId (not our internal database id).
 * Returns 404 if no establishment with that fhrsId exists, or if it exists but
 * isActive is false (i.e. it's dropped out of the FSA feed).
 *
 * The establishment page itself now fetches this same data server-side (see
 * src/lib/establishment-detail.ts) rather than calling this route — it's kept around as
 * a stable JSON endpoint for anything else that wants it. Response includes:
 *   - localAuthorityAverageRating: average FHRS rating for the same local authority
 *     (null for FHIS establishments, or if there's no comparable FHRS data)
 *   - otherLocations: other active branches sharing the same business name
 *   - ratingHistory: rating changes we've observed over time, newest first
 *   - fsaDetail: extra fields (phone, right-to-reply, score breakdown, new-rating-pending)
 *     fetched live from the FSA's per-establishment API — null if that call fails, since
 *     it's not in our own database and shouldn't block the rest of the page
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
    const [detail, fsaDetail] = await Promise.all([
      getEstablishmentDetailData(fhrsId),
      fetchFsaEstablishmentDetail(fhrsId),
    ]);

    if (!detail) {
      return jsonError(404, `No active establishment found with fhrsId ${fhrsId}.`);
    }

    const { establishment, localAuthorityAverageRating, otherLocations, ratingHistory } = detail;
    return NextResponse.json({ data: establishment, localAuthorityAverageRating, otherLocations, ratingHistory, fsaDetail });
  } catch (err) {
    console.error(`GET /api/establishments/${id} failed:`, err);
    return jsonError(500, "Internal server error while fetching establishment.");
  }
}
