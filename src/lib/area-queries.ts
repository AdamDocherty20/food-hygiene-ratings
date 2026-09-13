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
  businessTypeId: number;
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
  localAuthorityName: string | string[],
  businessTypeIds?: number[],
  page: number = 1,
): Promise<TopRatedInArea> {
  const rankExpr = ratingRankSql();

  // A string[] powers /area/london — London has no single local authority of its own (it's
  // split across 33 boroughs, see LONDON_BOROUGHS in local-authorities.ts), so that page
  // needs "in any of these" rather than "equals this one" — every other caller still passes
  // a plain string and gets the original equality behaviour.
  const authorityCondition = Array.isArray(localAuthorityName)
    ? Prisma.sql`"localAuthorityName" IN (${Prisma.join(localAuthorityName)})`
    : Prisma.sql`"localAuthorityName" = ${localAuthorityName}`;

  const conditions = [Prisma.sql`"isActive" = true`, authorityCondition];
  if (businessTypeIds && businessTypeIds.length > 0) {
    conditions.push(Prisma.sql`"businessTypeId" IN (${Prisma.join(businessTypeIds)})`);
  }
  const whereClause = Prisma.join(conditions, " AND ");
  const offset = (page - 1) * TOP_RATED_LIMIT;

  const [establishments, total] = await Promise.all([
    prisma.$queryRaw<AreaEstablishment[]>`
      SELECT "fhrsId", "businessName", "businessType", "businessTypeId", "addressLine1", "addressLine2", "addressLine3", "addressLine4",
             "postcode", "ratingValue", "ratingDate", "schemeType"
      FROM "Establishment"
      WHERE ${whereClause}
      ORDER BY ${rankExpr} DESC NULLS LAST, "businessName" ASC
      LIMIT ${TOP_RATED_LIMIT} OFFSET ${offset}
    `,
    prisma.establishment.count({
      where: {
        isActive: true,
        localAuthorityName: Array.isArray(localAuthorityName) ? { in: localAuthorityName } : localAuthorityName,
        ...(businessTypeIds && businessTypeIds.length > 0 ? { businessTypeId: { in: businessTypeIds } } : {}),
      },
    }),
  ]);

  return { establishments, total, page, totalPages: Math.max(1, Math.ceil(total / TOP_RATED_LIMIT)) };
}

// A meaningful-sample floor for the leaderboard below — without it, a tiny area with a
// handful of perfect-scoring businesses could outrank somewhere genuinely more consistent
// on the strength of a small sample. Chosen well below the smallest real areas' typical
// establishment counts (see local-authorities.ts) so this excludes only the true outliers.
const MIN_LEADERBOARD_SAMPLE = 300;

export interface AreaRatingLeaderboardEntry {
  localAuthorityName: string;
  averageRating: number;
  ratedCount: number;
}

/**
 * The UK's highest (numeric-FHRS-)rated local authorities, for /guide/best-rated-areas —
 * same AVG(("ratingValue")::int) pattern as getLocalAuthorityAverageRating in
 * establishment-detail.ts, just grouped across every area in one query instead of scoped
 * to one. FHRS-only (England/Wales/NI): FHIS's pass/improvement-required scale (Scotland)
 * has no numeric average to rank by, so Scottish areas can't appear here — that's a real
 * limitation of the comparison, not an oversight, and the page this feeds should say so.
 */
export async function getAreaRatingLeaderboard(limit: number = 20): Promise<AreaRatingLeaderboardEntry[]> {
  const rows = await prisma.$queryRaw<{ localAuthorityName: string; avg: number; count: bigint }[]>`
    SELECT "localAuthorityName", AVG(("ratingValue")::int)::float8 AS avg, COUNT(*) AS count
    FROM "Establishment"
    WHERE "isActive" = true
      AND "schemeType" = 'FHRS'
      AND "ratingValue" ~ '^[0-5]$'
    GROUP BY "localAuthorityName"
    HAVING COUNT(*) >= ${MIN_LEADERBOARD_SAMPLE}
    ORDER BY avg DESC, count DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    localAuthorityName: row.localAuthorityName,
    averageRating: Math.round(row.avg * 100) / 100,
    ratedCount: Number(row.count),
  }));
}
