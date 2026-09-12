// Plain-English meanings for each rating value — the single source of truth for this copy,
// shared between the About page's reference tables and the establishment page's
// rating-specific explainer sentence, so the wording can't drift between the two.

// FHRS (England, Wales & Northern Ireland) rates on a 0-5 scale. Order matches the badge
// colouring used elsewhere in the app: 4-5 green, 2-3 amber, 0-1 red.
export const FHRS_SCALE: { score: string; meaning: string }[] = [
  { score: "5", meaning: "Hygiene standards are very good" },
  { score: "4", meaning: "Hygiene standards are good" },
  { score: "3", meaning: "Hygiene standards are generally satisfactory" },
  { score: "2", meaning: "Some improvement is necessary" },
  { score: "1", meaning: "Major improvement is necessary" },
  { score: "0", meaning: "Urgent improvement is required" },
];

// FHIS (Scotland) is pass/fail rather than a numeric scale.
export const FHIS_SCALE: { score: string; meaning: string }[] = [
  { score: "Pass", meaning: "The business meets the required food hygiene standards" },
  { score: "Improvement Required", meaning: "The business needs to make improvements to meet the required standards" },
  { score: "Exempt", meaning: "The business type is exempt from the scheme (e.g. very low risk)" },
  { score: "Awaiting Inspection", meaning: "The business hasn't been inspected yet, or a report hasn't been published" },
];

/**
 * Looks up the plain-English meaning of a rating value, for the establishment page's
 * rating-specific explainer sentence. Returns null for values that don't match either
 * scale (shouldn't happen with real FSA data, but callers should treat it as "nothing to
 * show" rather than guessing).
 */
export function getRatingMeaning(schemeType: string, ratingValue: string): string | null {
  const scale = schemeType === "FHRS" ? FHRS_SCALE : FHIS_SCALE;
  return scale.find((entry) => entry.score === ratingValue)?.meaning ?? null;
}

export type RatingBand = "green" | "amber" | "red" | "gray";

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

/**
 * The red/amber/green (or gray, for anything unrated) categorisation used for the badge
 * colour, the hero card's accent stripe, and the static per-band OG images — a single
 * source of truth so the same rating always maps to the same colour everywhere.
 */
export function getRatingBand(schemeType: string, ratingValue: string): RatingBand {
  if (schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(ratingValue)) {
    const numeric = Number(ratingValue);
    if (numeric <= 1) return "red";
    if (numeric <= 3) return "amber";
    return "green";
  }
  if (schemeType === "FHIS") {
    const normalized = ratingValue.toLowerCase();
    if (normalized === "pass") return "green";
    if (normalized === "improvement required") return "amber";
  }
  return "gray";
}
