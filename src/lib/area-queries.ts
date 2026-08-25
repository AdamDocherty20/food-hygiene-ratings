import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ratingRankSql } from "@/lib/rating-rank";

// Shared by both /area/[slug] (whole area) and /area/[slug]/[category] ("best rated X in
// Y") landing pages — a curated top-N highlight list rather than a full paginated
// listing. Anyone wanting more than this can follow the "see all in search" link through
// to the normal filterable search page, which already handles arbitrarily large result
// sets; these landing pages exist for SEO discoverability and a fast first impression,
// not to replace search.
const TOP_RATED_LIMIT = 24;

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
}

/**
 * Fetches the top-rated (by ratingRankSql) establishments for a local authority,
 * optionally narrowed to a curated set of businessTypeIds, plus the total count of
 * matches (for "N establishments" copy and to decide whether the page has anything to
 * show at all — callers should notFound() when total is 0).
 */
export async function getTopRatedInArea(localAuthorityName: string, businessTypeIds?: number[]): Promise<TopRatedInArea> {
  const rankExpr = ratingRankSql();

  const conditions = [Prisma.sql`"isActive" = true`, Prisma.sql`"localAuthorityName" = ${localAuthorityName}`];
  if (businessTypeIds && businessTypeIds.length > 0) {
    conditions.push(Prisma.sql`"businessTypeId" IN (${Prisma.join(businessTypeIds)})`);
  }
  const whereClause = Prisma.join(conditions, " AND ");

  const [establishments, total] = await Promise.all([
    prisma.$queryRaw<AreaEstablishment[]>`
      SELECT "fhrsId", "businessName", "businessType", "addressLine1", "addressLine2", "addressLine3", "addressLine4",
             "postcode", "ratingValue", "ratingDate", "schemeType"
      FROM "Establishment"
      WHERE ${whereClause}
      ORDER BY ${rankExpr} DESC NULLS LAST, "businessName" ASC
      LIMIT ${TOP_RATED_LIMIT}
    `,
    prisma.establishment.count({
      where: {
        isActive: true,
        localAuthorityName,
        ...(businessTypeIds && businessTypeIds.length > 0 ? { businessTypeId: { in: businessTypeIds } } : {}),
      },
    }),
  ]);

  return { establishments, total };
}
