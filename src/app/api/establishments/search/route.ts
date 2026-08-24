import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/establishments/search
 *
 * Query params (all optional, combinable with AND):
 *   - name                (string, case-insensitive partial match on businessName)
 *   - postcode             (string, case-insensitive partial match)
 *   - businessTypeId       (integer, exact match)
 *   - ratingValue          (string, exact match — covers both "5" and "Pass")
 *   - localAuthorityName   (string, case-insensitive partial match)
 *   - page                 (integer, default 1)
 *   - pageSize              (integer, default 20, max 100)
 *
 * Only isActive: true establishments are returned.
 */
export async function GET(request: NextRequest) {
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
  } catch (err) {
    console.error("GET /api/establishments/search failed:", err);
    return jsonError(500, "Internal server error while searching establishments.");
  }
}
