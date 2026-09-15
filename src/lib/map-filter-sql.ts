import { Prisma } from "@/generated/prisma/client";
import type { ParseResult } from "@/lib/geo";

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

/**
 * Parses the comma-separated `ratings` query param shared by the map-clusters and
 * (future) area-stats endpoints — e.g. "5,4,3". Only the FHRS 0-5 scale is filterable
 * this way; there's no equivalent multi-select for FHIS's Pass/Improvement Required,
 * so leaving this param unset is the only way to see Scottish establishments alongside
 * a rating filter (documented on the map page itself, not hidden).
 */
export function parseRatingsFilter(raw: string | null): ParseResult<string[] | null> {
  if (!raw || !raw.trim()) return { ok: true, value: null };
  const values = raw.split(",").map((v) => v.trim());
  for (const value of values) {
    if (!NUMERIC_FHRS_VALUES.has(value)) {
      return { ok: false, error: `Invalid "ratings" value: "${value}". Must be one of 0, 1, 2, 3, 4, 5.` };
    }
  }
  return { ok: true, value: values };
}

/** Parses the comma-separated `businessTypeIds` query param, e.g. "1,7844". */
export function parseBusinessTypeIdsFilter(raw: string | null): ParseResult<number[] | null> {
  if (!raw || !raw.trim()) return { ok: true, value: null };
  const values = raw.split(",").map((v) => Number(v.trim()));
  for (const value of values) {
    if (!Number.isInteger(value)) {
      return { ok: false, error: `Invalid "businessTypeIds" value: "${raw}". Must be a comma-separated list of integers.` };
    }
  }
  return { ok: true, value: values };
}

/** Shared WHERE-clause fragments for the ratings/businessTypeIds filters above. */
export function buildMapFilterConditions(ratings: string[] | null, businessTypeIds: number[] | null) {
  const conditions: Prisma.Sql[] = [];
  if (ratings) conditions.push(Prisma.sql`"ratingValue" IN (${Prisma.join(ratings)})`);
  if (businessTypeIds) conditions.push(Prisma.sql`"businessTypeId" IN (${Prisma.join(businessTypeIds)})`);
  return conditions;
}
