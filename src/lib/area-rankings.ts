import type { AreaHygieneStats } from "@/lib/area-queries";
import { getNation, type Nation } from "@/lib/local-authority-nations";

export interface RankedArea extends AreaHygieneStats {
  /** 1-based rank by average rating, UK-wide (ties broken — see rankAreas). */
  rank: number;
  /** 1-based rank by average rating, within this area's own nation. */
  rankInNation: number;
  nation: Nation | null;
}

/**
 * Orders qualifying areas best-to-worst by average FHRS rating, and annotates each with
 * its overall and within-nation rank. Two areas can share the exact same 2-decimal-place
 * average (getAreaHygieneStats already rounds to that precision, so these are genuine
 * ties, not just a display artefact) — broken here by rated-business count (the area
 * with the larger sample is treated as the slightly more reliable of the two), then
 * alphabetically as a final, fully deterministic tiebreaker.
 */
export function rankAreas(stats: AreaHygieneStats[]): RankedArea[] {
  const sorted = [...stats].sort((a, b) => {
    if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
    if (b.ratedCount !== a.ratedCount) return b.ratedCount - a.ratedCount;
    return a.localAuthorityName.localeCompare(b.localAuthorityName);
  });

  const nationCounters = new Map<Nation, number>();

  return sorted.map((area, index) => {
    const nation = getNation(area.localAuthorityName);
    let rankInNation = 0;
    if (nation) {
      rankInNation = (nationCounters.get(nation) ?? 0) + 1;
      nationCounters.set(nation, rankInNation);
    }
    return { ...area, rank: index + 1, rankInNation, nation };
  });
}

/**
 * Same idea as rankAreas, but ordered by the share of businesses rated 5 rather than the
 * average rating — a separate, sometimes differently-ordered cut of the same qualifying
 * areas (an area can have a high average while still having a lower "rated 5" share than
 * one with a narrower spread of scores). Same tie-break logic.
 */
export function rankAreasByPctRated5(stats: AreaHygieneStats[]): (AreaHygieneStats & { rank: number })[] {
  const sorted = [...stats].sort((a, b) => {
    if (b.pctRated5 !== a.pctRated5) return b.pctRated5 - a.pctRated5;
    if (b.ratedCount !== a.ratedCount) return b.ratedCount - a.ratedCount;
    return a.localAuthorityName.localeCompare(b.localAuthorityName);
  });
  return sorted.map((area, index) => ({ ...area, rank: index + 1 }));
}
