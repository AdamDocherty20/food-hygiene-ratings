import { Prisma } from "@/generated/prisma/client";
import { boundingBoxDelta, distanceMilesSql } from "@/lib/geo";
import { getEstablishmentPhoto, type EstablishmentPhoto } from "@/lib/google-places";
import { prisma } from "@/lib/prisma";
import { computeRatingTrajectory, type RatingTrajectory } from "@/lib/rating-trajectory";
import type { Establishment, NearbyEstablishmentSummary, OtherLocation, RatingHistoryEntry } from "@/lib/types";

const NUMERIC_FHRS_PATTERN = /^[0-5]$/;
const NEARBY_RADIUS_MILES = 1;
const NEARBY_DISPLAY_COUNT = 6;
// ~5km, matching the app's existing mile-based "nearby" convention rather than mixing units.
const BUSINESS_TYPE_RADIUS_MILES = 3;

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
 * Average numeric FHRS rating among other active establishments of the *same FSA business
 * type* within a few miles — a narrower, more like-for-like comparison than the local
 * authority average above (a takeaway compared against other takeaways nearby, not against
 * every food business in the borough). Same bounding-box + Haversine pattern as
 * getNearbyEstablishments; only meaningful for numeric FHRS, same as the authority average.
 */
async function getNearbyBusinessTypeAverageRating(businessTypeId: number, lat: number, lng: number): Promise<number | null> {
  const { latDelta, lngDelta } = boundingBoxDelta(lat, BUSINESS_TYPE_RADIUS_MILES);
  const distanceExpr = distanceMilesSql(lat, lng);

  const candidates = Prisma.sql`
    SELECT "ratingValue", ${distanceExpr} AS "distanceMiles"
    FROM "Establishment"
    WHERE "isActive" = true
      AND "schemeType" = 'FHRS'
      AND "ratingValue" ~ '^[0-5]$'
      AND "businessTypeId" = ${businessTypeId}
      AND "latitude" IS NOT NULL
      AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND "longitude" BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
  `;

  const rows = await prisma.$queryRaw<{ avg: number | null }[]>`
    SELECT AVG(("ratingValue")::int)::float8 AS avg
    FROM (${candidates}) "nearby"
    WHERE "nearby"."distanceMiles" <= ${BUSINESS_TYPE_RADIUS_MILES}
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

export interface CompanyInfo {
  companyNumber: string;
  incorporationDate: string | null;
  companyStatus: string | null;
  matchConfidence: string;
}

/**
 * The Companies House match for this establishment, if any — see
 * scripts/match-companies-house.ts. Only ever returns a HIGH/MEDIUM (`publishable`) match;
 * LOW-confidence matches exist only for analysis and are never surfaced on the page.
 */
async function getCompanyInfo(fhrsId: number): Promise<CompanyInfo | null> {
  const match = await prisma.companyMatch.findUnique({
    where: { fhrsId, publishable: true },
    select: { companyNumber: true, incorporationDate: true, companyStatus: true, matchConfidence: true },
  });
  if (!match) return null;
  return { ...match, incorporationDate: toIsoOrNull(match.incorporationDate) };
}

export interface ChainInfo {
  wikidataId: string;
  chainName: string;
  foundedDate: string | null;
  headquarters: string | null;
  website: string | null;
}

/**
 * The Wikidata chain match for this establishment, if any — see
 * scripts/match-wikidata.ts. Matching there is exact-name-or-alias only (no confidence
 * tiers the way Companies House has), so every row that exists is safe to show directly.
 */
async function getChainInfo(fhrsId: number): Promise<ChainInfo | null> {
  const match = await prisma.chainMatch.findUnique({
    where: { fhrsId },
    select: { wikidataId: true, chainName: true, foundedDate: true, headquarters: true, website: true },
  });
  if (!match) return null;
  return { ...match, foundedDate: toIsoOrNull(match.foundedDate) };
}

export interface OsmInfo {
  matchMethod: string;
  cuisine: string | null;
  openingHours: string | null;
  takeaway: string | null;
  delivery: string | null;
  outdoorSeating: string | null;
  wheelchair: string | null;
  dietVegan: string | null;
  dietVegetarian: string | null;
  dietHalal: string | null;
  website: string | null;
  phone: string | null;
}

/**
 * The OpenStreetMap match for this establishment, if any — see scripts/match-osm.ts.
 * Unlike the other sources, OSM's ODbL licence carries a real attribution *requirement*,
 * not just a courtesy — any UI rendering these fields must show the attribution line (see
 * OsmInfoSection in EstablishmentDetailServer.tsx).
 */
async function getOsmInfo(fhrsId: number): Promise<OsmInfo | null> {
  const match = await prisma.osmMatch.findUnique({
    where: { fhrsId },
    select: {
      matchMethod: true,
      cuisine: true,
      openingHours: true,
      takeaway: true,
      delivery: true,
      outdoorSeating: true,
      wheelchair: true,
      dietVegan: true,
      dietVegetarian: true,
      dietHalal: true,
      website: true,
      phone: true,
    },
  });
  return match;
}

export interface EstablishmentDetailData {
  establishment: Establishment;
  /** Average FHRS rating for the same local authority, or null for FHIS/no comparable data. */
  localAuthorityAverageRating: number | null;
  /** Average FHRS rating for the same business type within ~3 miles, or null likewise. */
  nearbyBusinessTypeAverageRating: number | null;
  otherLocations: OtherLocation[];
  ratingHistory: RatingHistoryEntry[];
  /** Other active establishments within a mile, nearest first — empty if no coordinates. */
  nearby: NearbyEstablishmentSummary[];
  /** Derived from ratingHistory — see src/lib/rating-trajectory.ts. */
  trajectory: RatingTrajectory;
  /** Companies House match, if any — see getCompanyInfo. */
  company: CompanyInfo | null;
  /** Wikidata chain match, if any — see getChainInfo. */
  chain: ChainInfo | null;
  /** OpenStreetMap match, if any — see getOsmInfo. */
  osm: OsmInfo | null;
  /** A real photo of this establishment via Google Places, if available — see getEstablishmentPhoto. */
  photo: EstablishmentPhoto | null;
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
  const hasCoords = latitude !== null && longitude !== null;

  const [localAuthorityAverageRating, nearbyBusinessTypeAverageRating, otherLocations, ratingHistory, nearby, company, chain, osm, photo] =
    await Promise.all([
      isNumericFhrs ? getLocalAuthorityAverageRating(establishment.localAuthorityCode) : Promise.resolve(null),
      isNumericFhrs && hasCoords
        ? getNearbyBusinessTypeAverageRating(establishment.businessTypeId, latitude, longitude)
        : Promise.resolve(null),
      getOtherLocations(establishment.businessName, establishment.fhrsId),
      getRatingHistory(establishment.fhrsId),
      hasCoords ? getNearbyEstablishments(establishment.fhrsId, latitude, longitude) : Promise.resolve([]),
      getCompanyInfo(establishment.fhrsId),
      getChainInfo(establishment.fhrsId),
      getOsmInfo(establishment.fhrsId),
      getEstablishmentPhoto(establishment),
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
    nearbyBusinessTypeAverageRating,
    otherLocations,
    ratingHistory,
    nearby,
    trajectory: computeRatingTrajectory(toIsoOrNull(establishment.ratingDate), ratingHistory),
    company,
    chain,
    osm,
    photo,
  };
}
