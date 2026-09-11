import { Prisma } from "@/generated/prisma/client";
import { boundingBoxDelta, distanceMilesSql } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import type { Establishment, NearbyEstablishmentSummary, OtherLocation, RatingHistoryEntry } from "@/lib/types";

const NUMERIC_FHRS_PATTERN = /^[0-5]$/;
const NEARBY_RADIUS_MILES = 1;
const NEARBY_DISPLAY_COUNT = 6;

function toIsoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
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
async function getOtherLocations(businessName: string, fhrsId: number): Promise<OtherLocation[]> {
  const rows = await prisma.establishment.findMany({
    where: {
      isActive: true,
      fhrsId: { not: fhrsId },
      businessName: { equals: businessName, mode: "insensitive" },
    },
    select: { fhrsId: true, businessName: true, addressLine1: true, postcode: true, ratingValue: true, schemeType: true, ratingDate: true },
    orderBy: { businessName: "asc" },
    take: 6,
  });

  return rows.map((row) => ({ ...row, ratingDate: toIsoOrNull(row.ratingDate) }));
}

/**
 * Most recent rating changes for this establishment, newest first — written by the sync
 * script (scripts/sync.ts) whenever a re-run sees a different ratingValue/ratingDate than
 * what's stored. Most establishments will only have their single "first seen" entry until
 * they're re-inspected under this tracking, which is expected.
 */
async function getRatingHistory(fhrsId: number): Promise<RatingHistoryEntry[]> {
  const rows = await prisma.ratingHistory.findMany({
    where: { fhrsId },
    select: { ratingValue: true, schemeType: true, ratingDate: true, recordedAt: true },
    orderBy: { recordedAt: "desc" },
    take: 10,
  });

  return rows.map((row) => ({ ...row, ratingDate: toIsoOrNull(row.ratingDate), recordedAt: row.recordedAt.toISOString() }));
}

/**
 * Other active establishments within a mile, nearest first — reuses the same bounding-box
 * pre-filter + Haversine distance formula as /api/establishments/nearby (see
 * src/lib/geo.ts) so the two can't silently drift apart. Excludes the establishment itself
 * directly in SQL rather than over-fetching and filtering client-side.
 */
async function getNearbyEstablishments(fhrsId: number, lat: number, lng: number): Promise<NearbyEstablishmentSummary[]> {
  const { latDelta, lngDelta } = boundingBoxDelta(lat, NEARBY_RADIUS_MILES);
  const distanceExpr = distanceMilesSql(lat, lng);

  const candidates = Prisma.sql`
    SELECT "id", "fhrsId", "businessName", "addressLine1", "addressLine2", "addressLine3", "addressLine4",
           "postcode", "ratingValue", "schemeType", "ratingDate", ${distanceExpr} AS "distanceMiles"
    FROM "Establishment"
    WHERE "isActive" = true
      AND "fhrsId" != ${fhrsId}
      AND "latitude" IS NOT NULL
      AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND "longitude" BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
  `;

  const rows = await prisma.$queryRaw<(Omit<NearbyEstablishmentSummary, "ratingDate"> & { ratingDate: Date | null })[]>`
    SELECT * FROM (${candidates}) "nearby"
    WHERE "nearby"."distanceMiles" <= ${NEARBY_RADIUS_MILES}
    ORDER BY "nearby"."distanceMiles" ASC
    LIMIT ${NEARBY_DISPLAY_COUNT}
  `;

  return rows.map((row) => ({ ...row, ratingDate: toIsoOrNull(row.ratingDate) }));
}

export interface EstablishmentDetailData {
  establishment: Establishment;
  /** Average FHRS rating for the same local authority, or null for FHIS/no comparable data. */
  localAuthorityAverageRating: number | null;
  otherLocations: OtherLocation[];
  ratingHistory: RatingHistoryEntry[];
  /** Other active establishments within a mile, nearest first — empty if no coordinates. */
  nearby: NearbyEstablishmentSummary[];
}

/**
 * Fetches everything the establishment detail page needs straight from our own database —
 * deliberately excludes `fsaDetail` (phone, right-to-reply, score breakdown), which comes
 * from a live call to the FSA's own API and can be slow/fail; that stays fetched
 * client-side (see FsaDetailSection) so a flaky FSA response can't hold up server
 * rendering of the page's core content. Used by both the page itself and the
 * `/api/establishments/[id]` route so the two never drift apart.
 *
 * Returns null if no active establishment has this fhrsId.
 */
export async function getEstablishmentDetailData(fhrsId: number): Promise<EstablishmentDetailData | null> {
  const establishment = await prisma.establishment.findFirst({ where: { fhrsId, isActive: true } });
  if (!establishment) return null;

  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_PATTERN.test(establishment.ratingValue);
  const { latitude, longitude } = establishment;

  const [localAuthorityAverageRating, otherLocations, ratingHistory, nearby] = await Promise.all([
    isNumericFhrs ? getLocalAuthorityAverageRating(establishment.localAuthorityCode) : Promise.resolve(null),
    getOtherLocations(establishment.businessName, establishment.fhrsId),
    getRatingHistory(establishment.fhrsId),
    latitude !== null && longitude !== null
      ? getNearbyEstablishments(establishment.fhrsId, latitude, longitude)
      : Promise.resolve([]),
  ]);

  return {
    establishment: {
      ...establishment,
      ratingDate: toIsoOrNull(establishment.ratingDate),
      lastSeenAt: establishment.lastSeenAt.toISOString(),
      createdAt: establishment.createdAt.toISOString(),
      updatedAt: establishment.updatedAt.toISOString(),
    },
    localAuthorityAverageRating,
    otherLocations,
    ratingHistory,
    nearby,
  };
}
