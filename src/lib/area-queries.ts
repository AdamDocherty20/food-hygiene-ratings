import { Prisma } from "@/generated/prisma/client";
import { getLocalAuthorityByName, LONDON_BOROUGHS } from "@/lib/local-authorities";
import { getNation, type Nation } from "@/lib/local-authority-nations";
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

// The minimum number of *numerically rated* (FHRS 0-5) establishments a local authority
// needs before it's included in Compare Areas at all — without this, an authority with a
// handful of establishments could show a misleading 100%-rated-5 purely from small-sample
// noise. Deliberately lower than MIN_LEADERBOARD_SAMPLE above: that leaderboard is a
// curated "best in the UK" ranking meant to hold up to real scrutiny, while Compare Areas
// is an exploratory map where a visitor picks their own area — a smaller, still-meaningful
// sample is more useful there than hiding most of the country. A single named constant
// (rather than inlining 50 below) so this is easy to retune later.
export const MIN_COMPARE_AREA_SAMPLE = 50;

export interface AreaHygieneStats {
  localAuthorityName: string;
  slug: string | null;
  lat: number;
  lng: number;
  ratedCount: number;
  averageRating: number;
  pctRated5: number;
  pctRated4Or5: number;
  pctRated0To2: number;
  count0: number;
  count0To2: number;
}

interface AreaHygieneStatsRow {
  localAuthorityName: string;
  ratedCount: bigint;
  avg: number;
  count5: bigint;
  count4or5: bigint;
  count0to2: bigint;
  count0: bigint;
  lat: number | null;
  lng: number | null;
}

/**
 * Per-local-authority hygiene statistics for /food-hygiene-map's rankings and "Compare
 * areas" mode. FHRS-only (England/Wales/NI) for every rated-establishment calculation —
 * Scotland's FHIS scale has no numeric score to average or bucket into "rated 5" /
 * "rated 0-2", so mixing it in would be meaningless rather than just incomplete.
 * Scottish-only authorities simply won't meet the
 * `ratedCount >= minSample` bar and are absent from the result, not shown with fabricated
 * numbers.
 *
 * `lat`/`lng` are the centroid (mean position) of every active establishment in the
 * authority, not a real administrative boundary — good enough to place a single map
 * marker per area without needing a GeoJSON boundary dataset this app doesn't have.
 */
export async function getAreaHygieneStats(minSample: number = MIN_COMPARE_AREA_SAMPLE): Promise<AreaHygieneStats[]> {
  const rows = await prisma.$queryRaw<AreaHygieneStatsRow[]>`
    SELECT
      "localAuthorityName",
      COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" ~ '^[0-5]$') AS "ratedCount",
      AVG(("ratingValue")::int) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" ~ '^[0-5]$')::float8 AS avg,
      COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" = '5') AS count5,
      COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" IN ('4', '5')) AS count4or5,
      COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" IN ('0', '1', '2')) AS count0to2,
      COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" = '0') AS count0,
      AVG("latitude")::float8 AS lat,
      AVG("longitude")::float8 AS lng
    FROM "Establishment"
    WHERE "isActive" = true
    GROUP BY "localAuthorityName"
    HAVING COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" ~ '^[0-5]$') >= ${minSample}
  `;

  return rows
    .filter((row) => row.lat !== null && row.lng !== null)
    .map((row) => {
      const ratedCount = Number(row.ratedCount);
      return {
        localAuthorityName: row.localAuthorityName,
        slug: getLocalAuthorityByName(row.localAuthorityName)?.slug ?? null,
        lat: row.lat as number,
        lng: row.lng as number,
        ratedCount,
        averageRating: Math.round(row.avg * 100) / 100,
        pctRated5: Math.round((Number(row.count5) / ratedCount) * 1000) / 10,
        pctRated4Or5: Math.round((Number(row.count4or5) / ratedCount) * 1000) / 10,
        pctRated0To2: Math.round((Number(row.count0to2) / ratedCount) * 1000) / 10,
        count0: Number(row.count0),
        count0To2: Number(row.count0to2),
      };
    });
}

export interface RegionBreakdownEntry {
  areas: number;
  ratedCount: number;
  pctRated5: number;
}

export interface RegionalHygieneBreakdown {
  nations: (RegionBreakdownEntry & { nation: Nation })[];
  london: RegionBreakdownEntry;
  restOfUk: RegionBreakdownEntry;
  ukTotal: RegionBreakdownEntry;
}

const NATION_ORDER: Nation[] = ["England", "Wales", "Northern Ireland", "Scotland"];

/**
 * Nation- and London-level rollups for /food-hygiene-map's "how the nations, cities and
 * London compare" content. Deliberately unthresholded (every active FHRS establishment
 * counts, regardless of MIN_COMPARE_AREA_SAMPLE) — that per-area minimum exists so a tiny
 * authority can't rank misleadingly well or badly against its peers, but it has no
 * bearing on a genuine "how many businesses does this nation have and what share are
 * rated 5" total, which should include every area's real businesses.
 */
export async function getRegionalHygieneBreakdown(): Promise<RegionalHygieneBreakdown> {
  const rows = await prisma.$queryRaw<{ localAuthorityName: string; count5: bigint; ratedCount: bigint }[]>`
    SELECT "localAuthorityName",
      COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" = '5') AS count5,
      COUNT(*) FILTER (WHERE "schemeType" = 'FHRS' AND "ratingValue" ~ '^[0-5]$') AS "ratedCount"
    FROM "Establishment"
    WHERE "isActive" = true
    GROUP BY "localAuthorityName"
  `;

  const byNation = new Map<Nation, { areas: number; count5: number; ratedCount: number }>();
  const london = { areas: 0, count5: 0, ratedCount: 0 };
  const londonSet = new Set(LONDON_BOROUGHS);

  for (const row of rows) {
    const ratedCount = Number(row.ratedCount);
    if (ratedCount === 0) continue;
    const count5 = Number(row.count5);
    const nation = getNation(row.localAuthorityName);

    if (nation) {
      const entry = byNation.get(nation) ?? { areas: 0, count5: 0, ratedCount: 0 };
      entry.areas += 1;
      entry.count5 += count5;
      entry.ratedCount += ratedCount;
      byNation.set(nation, entry);
    }

    if (londonSet.has(row.localAuthorityName)) {
      london.areas += 1;
      london.count5 += count5;
      london.ratedCount += ratedCount;
    }
  }

  const pct = (count5: number, ratedCount: number) => (ratedCount > 0 ? Math.round((count5 / ratedCount) * 1000) / 10 : 0);

  const nations = NATION_ORDER.filter((n) => n !== "Scotland" && byNation.has(n)).map((nation) => {
    const entry = byNation.get(nation)!;
    return { nation, areas: entry.areas, ratedCount: entry.ratedCount, pctRated5: pct(entry.count5, entry.ratedCount) };
  });

  // UK total here means England + Wales + Northern Ireland — everywhere with a numeric
  // FHRS score. Scotland's FHIS scale has no equivalent "rated 5" figure to combine in.
  const ukCount5 = nations.reduce((sum, n) => sum + byNation.get(n.nation)!.count5, 0);
  const ukRatedCount = nations.reduce((sum, n) => sum + n.ratedCount, 0);
  const ukAreas = nations.reduce((sum, n) => sum + n.areas, 0);

  const restOfUk = {
    areas: ukAreas - london.areas,
    ratedCount: ukRatedCount - london.ratedCount,
    pctRated5: pct(ukCount5 - london.count5, ukRatedCount - london.ratedCount),
  };

  return {
    nations,
    london: { areas: london.areas, ratedCount: london.ratedCount, pctRated5: pct(london.count5, london.ratedCount) },
    restOfUk,
    ukTotal: { areas: ukAreas, ratedCount: ukRatedCount, pctRated5: pct(ukCount5, ukRatedCount) },
  };
}
