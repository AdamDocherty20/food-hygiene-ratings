import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { parseBoundingBox } from "@/lib/geo";
import { computeCellSizeDegrees, COUNT_CAP, INDIVIDUAL_MARKER_THRESHOLD } from "@/lib/map-clustering";
import { buildMapFilterConditions, parseBusinessTypeIdsFilter, parseRatingsFilter } from "@/lib/map-filter-sql";
import type { MapClusterCell, MapEstablishmentPoint } from "@/lib/map-types";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

// Raw shape of a row straight out of Postgres — ratingDate is a real Date here, but
// becomes an ISO string once it round-trips through NextResponse.json(), matching
// MapEstablishmentPoint's `ratingDate: string | null`.
type MapPointDbRow = Omit<MapEstablishmentPoint, "ratingDate"> & { ratingDate: Date | null };

/**
 * GET /api/establishments/map-clusters
 *
 * Query params:
 *   - north, south, east, west  (required, decimal degrees — the current Leaflet
 *     viewport bounds, i.e. map.getBounds())
 *   - ratings                   (optional, comma-separated FHRS values, e.g. "5,4,3")
 *   - businessTypeIds           (optional, comma-separated integers)
 *
 * Drives the /food-hygiene-map "Explore establishments" mode. With 600k+ active
 * establishments, sending every point in view straight to the browser doesn't scale —
 * this endpoint decides server-side whether the current viewport+filters are sparse
 * enough to return individual establishments (`mode: "points"`), or dense enough that it
 * should return grid-based cluster summaries instead (`mode: "clusters"`, each cell just
 * a center point + count). Either way the payload stays small and bounded regardless of
 * how far the visitor has zoomed out. See src/lib/map-clustering.ts for the thresholds.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);

  const bboxResult = parseBoundingBox(searchParams);
  if (!bboxResult.ok) return jsonError(400, bboxResult.error);
  const bbox = bboxResult.value;

  const ratingsResult = parseRatingsFilter(searchParams.get("ratings"));
  if (!ratingsResult.ok) return jsonError(400, ratingsResult.error);

  const businessTypeIdsResult = parseBusinessTypeIdsFilter(searchParams.get("businessTypeIds"));
  if (!businessTypeIdsResult.ok) return jsonError(400, businessTypeIdsResult.error);

  const conditions = [
    Prisma.sql`"isActive" = true`,
    Prisma.sql`"latitude" IS NOT NULL`,
    Prisma.sql`"longitude" IS NOT NULL`,
    Prisma.sql`"latitude" BETWEEN ${bbox.south} AND ${bbox.north}`,
    Prisma.sql`"longitude" BETWEEN ${bbox.west} AND ${bbox.east}`,
    ...buildMapFilterConditions(ratingsResult.value, businessTypeIdsResult.value),
  ];
  const whereClause = Prisma.join(conditions, " AND ");

  try {
    const countResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total FROM (
        SELECT 1 FROM "Establishment" WHERE ${whereClause} LIMIT ${COUNT_CAP}
      ) "capped"
    `;
    const totalCount = Number(countResult[0]?.total ?? 0);

    if (totalCount === 0) {
      return NextResponse.json({ mode: "points", points: [], clusters: [], totalCount: 0 });
    }

    if (totalCount <= INDIVIDUAL_MARKER_THRESHOLD) {
      const points = await prisma.$queryRaw<MapPointDbRow[]>`
        SELECT "id", "fhrsId", "businessName", "businessType", "ratingValue", "schemeType", "ratingDate",
               "addressLine1", "addressLine2", "addressLine3", "addressLine4", "postcode",
               "localAuthorityName", "latitude", "longitude"
        FROM "Establishment"
        WHERE ${whereClause}
        LIMIT ${INDIVIDUAL_MARKER_THRESHOLD}
      `;
      return NextResponse.json({ mode: "points", points, clusters: [], totalCount });
    }

    const cellSize = computeCellSizeDegrees(bbox);
    const clusters = await prisma.$queryRaw<{ count: bigint; lat: number; lng: number }[]>`
      SELECT COUNT(*)::bigint AS count, AVG("latitude") AS lat, AVG("longitude") AS lng
      FROM "Establishment"
      WHERE ${whereClause}
      GROUP BY FLOOR("latitude" / ${cellSize}), FLOOR("longitude" / ${cellSize})
    `;

    const clusterCells: MapClusterCell[] = clusters.map((c) => ({ lat: c.lat, lng: c.lng, count: Number(c.count) }));

    return NextResponse.json({ mode: "clusters", points: [], clusters: clusterCells, totalCount });
  } catch (err) {
    console.error("GET /api/establishments/map-clusters failed:", err);
    return jsonError(500, "Internal server error while fetching map data.");
  }
}
