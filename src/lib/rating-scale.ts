// Plain-English meanings for each rating value — the single source of truth for this copy,
// shared between the About page's reference tables and the establishment page's
// rating-specific explainer sentence, so the wording can't drift between the two.

// FHRS (England, Wales & Northern Ireland) rates on a 0-5 scale. Order matches the badge
// colouring used elsewhere in the app: 4-5 green, 2-3 amber, 0-1 red. `shortLabel` is the
// FSA's own short-form wording for each score (used on their stickers/site) — kept here
// alongside `meaning` (the fuller sentence used in the establishment-page explainer and
// the About page's table) rather than as a separate list, so both stay in sync.
export const FHRS_SCALE: { score: string; shortLabel: string; meaning: string }[] = [
  { score: "5", shortLabel: "Very Good", meaning: "Hygiene standards are very good" },
  { score: "4", shortLabel: "Good", meaning: "Hygiene standards are good" },
  { score: "3", shortLabel: "Generally Satisfactory", meaning: "Hygiene standards are generally satisfactory" },
  { score: "2", shortLabel: "Improvement Necessary", meaning: "Some improvement is necessary" },
  { score: "1", shortLabel: "Major Improvement Necessary", meaning: "Major improvement is necessary" },
  { score: "0", shortLabel: "Urgent Improvement Necessary", meaning: "Urgent improvement is required" },
];

// A finer six-step gradient than getRatingBand's red/amber/green below — that 3-tier
// grouping is right for small badges, but flattens 5-and-4 (or 1-and-0) into the same
// colour, losing the distinction a score-by-score breakdown like this is meant to show.
export const FHRS_SCORE_COLOR_CLASSES: Record<string, string> = {
  "5": "bg-green-700",
  "4": "bg-green-600",
  "3": "bg-yellow-400",
  "2": "bg-amber-500",
  "1": "bg-orange-700",
  "0": "bg-red-700",
};

// Same six-step gradient as FHRS_SCORE_COLOR_CLASSES, as literal hex values — for the
// /food-hygiene-map establishment markers, which are plain Leaflet divIcons (raw HTML
// strings built outside React, not JSX) and so can't rely on Tailwind's class scanning to
// pick up dynamically-interpolated class names. Kept in lockstep with the Tailwind
// version above rather than computed from it, since there's no reliable way to resolve a
// Tailwind class to its hex value at runtime without the full Tailwind engine.
export const FHRS_SCORE_HEX: Record<string, string> = {
  "5": "#15803d",
  "4": "#16a34a",
  "3": "#facc15",
  "2": "#f59e0b",
  "1": "#c2410c",
  "0": "#b91c1c",
};

// Hex equivalents of getRatingBand's three bands, plus gray — same "raw HTML, no
// Tailwind class scanning" reasoning as FHRS_SCORE_HEX above. Used for FHIS (Scotland)
// markers, which have no 0-5 score to look up in FHRS_SCORE_HEX.
export const RATING_BAND_HEX: Record<RatingBand, string> = {
  green: "#15803d",
  amber: "#f59e0b",
  red: "#b91c1c",
  gray: "#6b7280",
};

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
