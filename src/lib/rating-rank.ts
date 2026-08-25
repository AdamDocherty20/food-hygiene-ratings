import { Prisma } from "@/generated/prisma/client";

/**
 * Maps both rating schemes onto a common 0-5 "best first" scale for SQL ORDER BY use.
 * ratingValue is a free-text string ("0"-"5" for FHRS, or a status like "Pass"/
 * "Improvement Required" for FHIS), so there's no column a typed ORDER BY can sort
 * meaningfully by "best first" — this CASE expression is the shared definition of what
 * "best rated" means across the app. Anything with no meaningful rating (awaiting
 * inspection/publication, exempt) sorts last regardless of direction.
 *
 * Shared by /api/establishments/search's rating_desc/rating_asc sort and the /area
 * landing pages' "top rated" ordering, so both use an identical definition of "best".
 */
export function ratingRankSql() {
  return Prisma.sql`CASE
    WHEN "schemeType" = 'FHRS' AND "ratingValue" ~ '^[0-5]$' THEN ("ratingValue")::int
    WHEN "schemeType" = 'FHIS' AND "ratingValue" IN ('Pass', 'Pass and Eat Safe') THEN 5
    WHEN "schemeType" = 'FHIS' AND "ratingValue" = 'Improvement Required' THEN 1
    ELSE NULL
  END`;
}
