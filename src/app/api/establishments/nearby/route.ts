import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const EARTH_RADIUS_MILES = 3959;
const DEFAULT_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 10;

interface EstablishmentWithDistance {
  id: number;
  fhrsId: number;
  localAuthorityBusinessId: string;
  businessName: string;
  businessType: string;
  businessTypeId: number;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postcode: string | null;
  ratingValue: string;
  ratingKey: string;
  ratingDate: Date | null;
  schemeType: string;
  latitude: number | null;
  longitude: number | null;
  localAuthorityName: string;
  localAuthorityCode: string;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  distanceMiles: number;
}

function parseRequiredCoordinate(
  raw: string | null,
  name: string,
  min: number,
  max: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === null || raw === "") {
    return { ok: false, error: `Missing required query param "${name}".` };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    return {
      ok: false,
      error: `Invalid "${name}" value: "${raw}". Must be a number between ${min} and ${max}.`,
    };
  }
  return { ok: true, value };
}

/**
 * GET /api/establishments/nearby
 *
 * Query params:
 *   - lat, lng       (required, decimal degrees)
 *   - radiusMiles    (optional, default 1, capped at 10)
 *   - page, pageSize (optional, same pagination as /search)
 *
 * Only considers establishments with non-null latitude/longitude and isActive: true.
 * Distance is computed with the Haversine formula in raw SQL (no PostGIS needed) and
 * results are sorted nearest-first, with each result annotated with distanceMiles.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);

  const pagination = parsePagination(searchParams);
  if (!pagination.ok) {
    return jsonError(400, pagination.error);
  }
  const { page, pageSize, skip, take } = pagination.value;

  const latResult = parseRequiredCoordinate(searchParams.get("lat"), "lat", -90, 90);
  if (!latResult.ok) return jsonError(400, latResult.error);

  const lngResult = parseRequiredCoordinate(searchParams.get("lng"), "lng", -180, 180);
  if (!lngResult.ok) return jsonError(400, lngResult.error);

  const lat = latResult.value;
  const lng = lngResult.value;

  let radiusMiles = DEFAULT_RADIUS_MILES;
  const radiusRaw = searchParams.get("radiusMiles");
  if (radiusRaw !== null && radiusRaw !== "") {
    radiusMiles = Number(radiusRaw);
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
      return jsonError(400, `Invalid "radiusMiles" value: "${radiusRaw}". Must be a positive number.`);
    }
  }
  if (radiusMiles > MAX_RADIUS_MILES) {
    radiusMiles = MAX_RADIUS_MILES;
  }

  // Cheap bounding-box pre-filter (can use the (latitude, longitude) index) before the
  // precise Haversine calculation below, so we're not running trig functions over the
  // entire table on every request. The box is deliberately generous (69 miles/degree of
  // latitude is a slight underestimate at UK latitudes) so it can only include extra
  // candidate rows, never exclude a true match — the exact Haversine filter after it is
  // what actually enforces the radius.
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const distanceExpr = Prisma.sql`${EARTH_RADIUS_MILES} * acos(
    LEAST(1, GREATEST(-1,
      cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng}))
      + sin(radians(${lat})) * sin(radians("latitude"))
    ))
  )`;

  const candidates = Prisma.sql`
    SELECT *, ${distanceExpr} AS "distanceMiles"
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

    const results = await prisma.$queryRaw<EstablishmentWithDistance[]>`
      SELECT *
      FROM (${candidates}) "nearby"
      WHERE "nearby"."distanceMiles" <= ${radiusMiles}
      ORDER BY "nearby"."distanceMiles" ASC
      LIMIT ${take} OFFSET ${skip}
    `;

    return NextResponse.json({
      data: results,
      pagination: buildPaginationMeta(page, pageSize, total),
      query: { lat, lng, radiusMiles },
    });
  } catch (err) {
    console.error("GET /api/establishments/nearby failed:", err);
    return jsonError(500, "Internal server error while searching nearby establishments.");
  }
}
