import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { cuisineFilterSql } from "@/lib/cuisine-filter-sql";
import { getCuisineBySlug } from "@/lib/cuisines";
import { boundingBoxDelta, distanceMilesSql, parseRequiredCoordinate, parseRadiusMiles } from "@/lib/geo";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

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

  const radiusResult = parseRadiusMiles(searchParams.get("radiusMiles"));
  if (!radiusResult.ok) return jsonError(400, radiusResult.error);
  const radiusMiles = radiusResult.value;

  const cuisineSlug = searchParams.get("cuisine")?.trim();
  const cuisine = cuisineSlug ? getCuisineBySlug(cuisineSlug) : null;
  if (cuisineSlug && !cuisine) {
    return jsonError(400, `Invalid "cuisine" value: "${cuisineSlug}".`);
  }

  const { latDelta, lngDelta } = boundingBoxDelta(lat, radiusMiles);
  const distanceExpr = distanceMilesSql(lat, lng);

  const candidates = Prisma.sql`
    SELECT *, ${distanceExpr} AS "distanceMiles"
    FROM "Establishment"
    WHERE "isActive" = true
      AND "latitude" IS NOT NULL
      AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND "longitude" BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
      ${cuisine ? Prisma.sql`AND ${cuisineFilterSql(cuisine)}` : Prisma.empty}
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
