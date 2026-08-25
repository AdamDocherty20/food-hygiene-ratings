import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ratingRankSql } from "@/lib/rating-rank";

const SORT_VALUES = new Set(["name", "rating_desc", "rating_asc"]);

// Shape of a raw-SQL "SELECT *" row, used only for the rating-sort branch below (the
// name-sort branch uses Prisma's typed findMany instead). Mirrors the Establishment
// model 1:1 — see EstablishmentWithDistance in the nearby route for the same pattern.
interface EstablishmentRow {
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
}

/**
 * GET /api/establishments/search
 *
 * Query params (all optional, combinable with AND):
 *   - name                (string, case-insensitive partial match on businessName)
 *   - postcode             (string, case-insensitive partial match)
 *   - businessTypeId       (integer, exact match)
 *   - ratingValue          (string, exact match — covers both "5" and "Pass")
 *   - localAuthorityName   (string, case-insensitive partial match)
 *   - sort                  ("name" default, "rating_desc", or "rating_asc")
 *   - page                 (integer, default 1)
 *   - pageSize              (integer, default 20, max 100)
 *
 * Only isActive: true establishments are returned.
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

  const name = searchParams.get("name")?.trim();
  const postcode = searchParams.get("postcode")?.trim();
  const localAuthorityName = searchParams.get("localAuthorityName")?.trim();
  const ratingValue = searchParams.get("ratingValue")?.trim();

  const sort = searchParams.get("sort")?.trim() || "name";
  if (!SORT_VALUES.has(sort)) {
    return jsonError(400, `Invalid "sort" value: "${sort}". Must be one of: ${[...SORT_VALUES].join(", ")}.`);
  }

  let businessTypeId: number | undefined;
  const businessTypeIdRaw = searchParams.get("businessTypeId");
  if (businessTypeIdRaw !== null && businessTypeIdRaw !== "") {
    businessTypeId = Number(businessTypeIdRaw);
    if (!Number.isInteger(businessTypeId)) {
      return jsonError(400, `Invalid "businessTypeId" value: "${businessTypeIdRaw}". Must be an integer.`);
    }
  }

  const where: Prisma.EstablishmentWhereInput = {
    isActive: true,
    ...(name ? { businessName: { contains: name, mode: "insensitive" } } : {}),
    ...(postcode ? { postcode: { contains: postcode, mode: "insensitive" } } : {}),
    ...(localAuthorityName ? { localAuthorityName: { contains: localAuthorityName, mode: "insensitive" } } : {}),
    ...(ratingValue ? { ratingValue } : {}),
    ...(businessTypeId !== undefined ? { businessTypeId } : {}),
  };

  try {
    if (sort === "name") {
      const [total, results] = await Promise.all([
        prisma.establishment.count({ where }),
        prisma.establishment.findMany({
          where,
          orderBy: { businessName: "asc" },
          skip,
          take,
        }),
      ]);

      return NextResponse.json({
        data: results,
        pagination: buildPaginationMeta(page, pageSize, total),
      });
    }

    // Rating sort needs a raw query: ratingValue is a free-text string, so there's no
    // column Prisma's typed orderBy can sort meaningfully by "best first" — see
    // ratingRankSql's own comment for what it does.
    const rankExpr = ratingRankSql();

    const conditions = [Prisma.sql`"isActive" = true`];
    if (name) conditions.push(Prisma.sql`"businessName" ILIKE ${`%${name}%`}`);
    if (postcode) conditions.push(Prisma.sql`"postcode" ILIKE ${`%${postcode}%`}`);
    if (localAuthorityName) conditions.push(Prisma.sql`"localAuthorityName" ILIKE ${`%${localAuthorityName}%`}`);
    if (ratingValue) conditions.push(Prisma.sql`"ratingValue" = ${ratingValue}`);
    if (businessTypeId !== undefined) conditions.push(Prisma.sql`"businessTypeId" = ${businessTypeId}`);
    const whereClause = Prisma.join(conditions, " AND ");

    const direction = sort === "rating_desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

    const [countResult, results] = await Promise.all([
      prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*)::bigint AS total FROM "Establishment" WHERE ${whereClause}
      `,
      prisma.$queryRaw<EstablishmentRow[]>`
        SELECT * FROM "Establishment"
        WHERE ${whereClause}
        ORDER BY ${rankExpr} ${direction} NULLS LAST, "businessName" ASC
        LIMIT ${take} OFFSET ${skip}
      `,
    ]);
    const total = Number(countResult[0]?.total ?? 0);

    return NextResponse.json({
      data: results,
      pagination: buildPaginationMeta(page, pageSize, total),
    });
  } catch (err) {
    console.error("GET /api/establishments/search failed:", err);
    return jsonError(500, "Internal server error while searching establishments.");
  }
}
