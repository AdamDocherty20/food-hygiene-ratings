import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { boundingBoxDelta, distanceMilesSql, parseRequiredCoordinate, parseRadiusMiles } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

// Deliberately much higher than the paginated /nearby endpoint's pageSize (max 100) —
// this route only returns the handful of fields a map pin needs, so it's cheap to send
// more of them. Lets the map show every establishment in view (e.g. after "Search this
// area" widens the radius) instead of being capped to a single page of results.
const MAP_POINT_LIMIT = 500;

interface MapPointRow {
  id: number;
  fhrsId: number;
  businessName: string;
  latitude: number;
  longitude: number;
}

/**
 * GET /api/establishments/nearby/map
 *
 * Query params:
 *   - lat, lng    (required, decimal degrees)
 *   - radiusMiles (optional, default 1, capped at 10 — same as /nearby)
 *
 * A lighter-weight sibling of /api/establishments/nearby, for driving the map rather
 * than the results list: no pagination, no address/rating fields, just enough to place
 * and label a pin — but up to MAP_POINT_LIMIT of them instead of one page's worth.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);

  const latResult = parseRequiredCoordinate(searchParams.get("lat"), "lat", -90, 90);
  if (!latResult.ok) return jsonError(400, latResult.error);

  const lngResult = parseRequiredCoordinate(searchParams.get("lng"), "lng", -180, 180);
  if (!lngResult.ok) return jsonError(400, lngResult.error);

  const lat = latResult.value;
  const lng = lngResult.value;

  const radiusResult = parseRadiusMiles(searchParams.get("radiusMiles"));
  if (!radiusResult.ok) return jsonError(400, radiusResult.error);
  const radiusMiles = radiusResult.value;

  const { latDelta, lngDelta } = boundingBoxDelta(lat, radiusMiles);
  const distanceExpr = distanceMilesSql(lat, lng);

  const candidates = Prisma.sql`
    SELECT "id", "fhrsId", "businessName", "latitude", "longitude", ${distanceExpr} AS "distanceMiles"
    FROM "Establishment"
    WHERE "isActive" = true
      AND "latitude" IS NOT NULL
      AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND "longitude" BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
  `;

  try {
    const countResult = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM (${candidates}) "nearby"
      WHERE "nearby"."distanceMiles" <= ${radiusMiles}
    `;
    const total = Number(countResult[0]?.total ?? 0);

    const results = await prisma.$queryRaw<MapPointRow[]>`
      SELECT "id", "fhrsId", "businessName", "latitude", "longitude"
      FROM (${candidates}) "nearby"
      WHERE "nearby"."distanceMiles" <= ${radiusMiles}
      ORDER BY "nearby"."distanceMiles" ASC
      LIMIT ${MAP_POINT_LIMIT}
    `;

    return NextResponse.json({
      data: results,
      truncated: total > MAP_POINT_LIMIT,
      query: { lat, lng, radiusMiles },
    });
  } catch (err) {
    console.error("GET /api/establishments/nearby/map failed:", err);
    return jsonError(500, "Internal server error while fetching map points.");
  }
}
