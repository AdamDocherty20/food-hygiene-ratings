import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ratingRankSql } from "@/lib/rating-rank";

// Shared by both /area/[slug] (whole area) and /area/[slug]/[category] ("best rated X in
// Y") landing pages — also the page size for pagination beyond page 1 (see `page` below),
// which exists so every establishment in an area is reachable via a real internal link,
// not just the top page's worth. Exported so callers can compute result ranges without
// duplicating this number.
export const TOP_RATED_LIMIT = 24;

export interface AreaEstablishment {
  fhrsId: number;
  businessName: string;
  businessType: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postcode: string | null;
  ratingValue: string;
  ratingDate: Date | null;
  schemeType: string;
}

export interface TopRatedInArea {
  establishments: AreaEstablishment[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Fetches a page of establishments for a local authority (ranked by ratingRankSql),
 * optionally narrowed to a curated set of businessTypeIds, plus the total count of
 * matches (for "N establishments" copy and to decide whether the page has anything to
 * show at all — callers should notFound() when total is 0).
 *
 * `page` defaults to 1 (the original top-24 behaviour, unchanged). Paging beyond that
 * exists so every establishment in an area — not just the top 24 — is reachable via a
 * real, crawlable internal link rather than only through the sitemap: with 600k+
 * establishment pages and only a few thousand ever linked to from an area/category page,
 * the rest were effectively orphaned as far as crawl priority goes.
 */
export async function getTopRatedInArea(
  localAuthorityName: string,
  businessTypeIds?: number[],
  page: number = 1,
): Promise<TopRatedInArea> {
  const rankExpr = ratingRankSql();

  const conditions = [Prisma.sql`"isActive" = true`, Prisma.sql`"localAuthorityName" = ${localAuthorityName}`];
  if (businessTypeIds && businessTypeIds.length > 0) {
    conditions.push(Prisma.sql`"businessTypeId" IN (${Prisma.join(businessTypeIds)})`);
  }
  const whereClause = Prisma.join(conditions, " AND ");
  const offset = (page - 1) * TOP_RATED_LIMIT;

  const [establishments, total] = await Promise.all([
    prisma.$queryRaw<AreaEstablishment[]>`
      SELECT "fhrsId", "businessName", "businessType", "addressLine1", "addressLine2", "addressLine3", "addressLine4",
             "postcode", "ratingValue", "ratingDate", "schemeType"
      FROM "Establishment"
      WHERE ${whereClause}
      ORDER BY ${rankExpr} DESC NULLS LAST, "businessName" ASC
      LIMIT ${TOP_RATED_LIMIT} OFFSET ${offset}
    `,
    prisma.establishment.count({
      where: {
        isActive: true,
        localAuthorityName,
        ...(businessTypeIds && businessTypeIds.length > 0 ? { businessTypeId: { in: businessTypeIds } } : {}),
      },
    }),
  ]);

  return { establishments, total, page, totalPages: Math.max(1, Math.ceil(total / TOP_RATED_LIMIT)) };
}
