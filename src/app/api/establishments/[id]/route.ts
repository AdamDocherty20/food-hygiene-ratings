import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { fetchFsaEstablishmentDetail } from "@/lib/fsa-api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const NUMERIC_FHRS_PATTERN = /^[0-5]$/;

interface OtherLocationRow {
  fhrsId: number;
  businessName: string;
  addressLine1: string | null;
  postcode: string | null;
  ratingValue: string;
  schemeType: string;
  ratingDate: Date | null;
}

/**
 * Average numeric FHRS rating across other active establishments in the same local
 * authority — used to show "rated above/below average for {authority}" on the detail
 * page. Only meaningful for FHRS's 0-5 scale, so FHIS establishments (and FHRS ones with
 * a non-numeric status like "Awaiting Inspection") are excluded from both sides of the
 * comparison.
 */
async function getLocalAuthorityAverageRating(localAuthorityCode: string): Promise<number | null> {
  // Cast to float8 (not left as NUMERIC) so Prisma hands back a plain JS number instead
  // of a Decimal object — otherwise `typeof avg === "number"` below would never be true.
  const rows = await prisma.$queryRaw<{ avg: number | null }[]>`
    SELECT AVG(("ratingValue")::int)::float8 AS avg
    FROM "Establishment"
    WHERE "isActive" = true
      AND "schemeType" = 'FHRS'
      AND "ratingValue" ~ '^[0-5]$'
      AND "localAuthorityCode" = ${localAuthorityCode}
  `;
  const avg = rows[0]?.avg;
  return typeof avg === "number" ? Math.round(avg * 10) / 10 : null;
}

/**
 * Other branches of the same chain — active establishments sharing the exact business
 * name (case-insensitive) but a different fhrsId. Useful for chains (e.g. a supermarket
 * or takeaway franchise) where a visitor might want to check a different branch's rating.
 */
async function getOtherLocations(businessName: string, fhrsId: number): Promise<OtherLocationRow[]> {
  return prisma.establishment.findMany({
    where: {
      isActive: true,
      fhrsId: { not: fhrsId },
      businessName: { equals: businessName, mode: "insensitive" },
    },
    select: { fhrsId: true, businessName: true, addressLine1: true, postcode: true, ratingValue: true, schemeType: true, ratingDate: true },
    orderBy: { businessName: "asc" },
    take: 6,
  });
}

/**
 * Most recent rating changes for this establishment, newest first — written by the sync
 * script (scripts/sync.ts) whenever a re-run sees a different ratingValue/ratingDate than
 * what's stored. Most establishments will only have their single "first seen" entry until
 * they're re-inspected under this tracking, which is expected.
 */
async function getRatingHistory(fhrsId: number) {
  return prisma.ratingHistory.findMany({
    where: { fhrsId },
    select: { ratingValue: true, schemeType: true, ratingDate: true, recordedAt: true },
    orderBy: { recordedAt: "desc" },
    take: 10,
  });
}

/**
 * GET /api/establishments/[id]
 *
 * [id] is the FSA's stable fhrsId (not our internal database id).
 * Returns 404 if no establishment with that fhrsId exists, or if it exists but
 * isActive is false (i.e. it's dropped out of the FSA feed).
 *
 * Response also includes:
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
    const establishment = await prisma.establishment.findFirst({
      where: { fhrsId, isActive: true },
    });

    if (!establishment) {
      return jsonError(404, `No active establishment found with fhrsId ${fhrsId}.`);
    }

    const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_PATTERN.test(establishment.ratingValue);

    const [localAuthorityAverageRating, otherLocations, ratingHistory, fsaDetail] = await Promise.all([
      isNumericFhrs ? getLocalAuthorityAverageRating(establishment.localAuthorityCode) : Promise.resolve(null),
      getOtherLocations(establishment.businessName, establishment.fhrsId),
      getRatingHistory(establishment.fhrsId),
      fetchFsaEstablishmentDetail(establishment.fhrsId),
    ]);

    return NextResponse.json({ data: establishment, localAuthorityAverageRating, otherLocations, ratingHistory, fsaDetail });
  } catch (err) {
    console.error(`GET /api/establishments/${id} failed:`, err);
    return jsonError(500, "Internal server error while fetching establishment.");
  }
}
