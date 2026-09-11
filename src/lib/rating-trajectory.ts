import { humanizeStatus } from "@/lib/format";
import type { RatingHistoryEntry } from "@/lib/types";

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

// FHIS has no numeric scale, just the two ranked outcomes below — Exempt/Awaiting
// Inspection/Awaiting Publication have no ordering, so they're deliberately left out of
// this map (ratingRank returns null for them, which suppresses direction comparisons).
const FHIS_RANK: Record<string, number> = { Pass: 1, "Improvement Required": 0 };

// A business hasn't necessarily gotten worse just because two years have passed — but past
// this point the displayed rating is old enough that it's worth telling a visitor so,
// rather than letting a stale "5 out of 5" read as current. ~730 days = roughly 2 years.
const STALE_INSPECTION_DAYS = 730;

function ratingLabel(schemeType: string, ratingValue: string): string {
  return schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(ratingValue) ? `${ratingValue}/5` : humanizeStatus(ratingValue);
}

function ratingRank(schemeType: string, ratingValue: string): number | null {
  if (schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(ratingValue)) return Number(ratingValue);
  if (schemeType === "FHIS" && ratingValue in FHIS_RANK) return FHIS_RANK[ratingValue];
  return null;
}

export type RatingDirection = "improved" | "declined";

export interface RatingTrajectory {
  /** null when there's no earlier *different* rating on record to compare against. */
  direction: RatingDirection | null;
  /** Human label of the most recent rating that differed from the current one, e.g. "3/5". */
  previousRatingLabel: string | null;
  /** How many of the most recent inspections in a row landed on the current rating (>= 1, or 0 if there's no history at all). */
  consecutiveAtCurrentRating: number;
  daysSinceLastInspection: number | null;
  staleInspection: boolean;
}

/**
 * Derives "has this establishment's rating been improving, declining, or holding steady"
 * purely from data already on hand — no new external source needed. RatingHistory only
 * ever gets a new row when the FSA's ratingValue or ratingDate changes (see
 * prisma/schema.prisma), so consecutive entries sharing the same ratingValue represent
 * repeat inspections landing on the same score, and the next entry with a different value
 * is the most recent real change.
 */
export function computeRatingTrajectory(ratingDate: string | null, ratingHistory: RatingHistoryEntry[]): RatingTrajectory {
  const daysSinceLastInspection = ratingDate
    ? Math.floor((Date.now() - new Date(ratingDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const staleInspection = daysSinceLastInspection !== null && daysSinceLastInspection > STALE_INSPECTION_DAYS;

  if (ratingHistory.length === 0) {
    return { direction: null, previousRatingLabel: null, consecutiveAtCurrentRating: 0, daysSinceLastInspection, staleInspection };
  }

  const current = ratingHistory[0];
  let consecutiveAtCurrentRating = 1;
  while (
    consecutiveAtCurrentRating < ratingHistory.length &&
    ratingHistory[consecutiveAtCurrentRating].ratingValue === current.ratingValue &&
    ratingHistory[consecutiveAtCurrentRating].schemeType === current.schemeType
  ) {
    consecutiveAtCurrentRating++;
  }

  const previousDifferent = ratingHistory[consecutiveAtCurrentRating];
  let direction: RatingDirection | null = null;
  let previousRatingLabel: string | null = null;

  if (previousDifferent && previousDifferent.schemeType === current.schemeType) {
    const currentRank = ratingRank(current.schemeType, current.ratingValue);
    const previousRank = ratingRank(previousDifferent.schemeType, previousDifferent.ratingValue);
    if (currentRank !== null && previousRank !== null && currentRank !== previousRank) {
      direction = currentRank > previousRank ? "improved" : "declined";
      previousRatingLabel = ratingLabel(previousDifferent.schemeType, previousDifferent.ratingValue);
    }
  }

  return { direction, previousRatingLabel, consecutiveAtCurrentRating, daysSinceLastInspection, staleInspection };
}

export { ratingLabel };
