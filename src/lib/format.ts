import type { Establishment } from "@/lib/types";

/**
 * Joins whatever address lines + postcode are actually populated. FSA data is
 * sparsely populated (e.g. only addressLine2 and addressLine4 present), so this
 * just filters out the gaps rather than assuming a fixed set of lines.
 */
export function formatAddress(establishment: Pick<Establishment, "addressLine1" | "addressLine2" | "addressLine3" | "addressLine4" | "postcode">): string {
  const parts = [
    establishment.addressLine1,
    establishment.addressLine2,
    establishment.addressLine3,
    establishment.addressLine4,
    establishment.postcode,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.length > 0 ? parts.join(", ") : "Address not available";
}

/**
 * Rating dates are shown next to every rating in the app (a legal requirement of the
 * FSA/OGL attribution terms, not just a UX nicety) — this is the single place that
 * formatting lives so every usage stays consistent.
 */
export function formatRatingDate(ratingDate: string | null): string {
  if (!ratingDate) return "Rating date not available";

  const date = new Date(ratingDate);
  if (Number.isNaN(date.getTime())) return "Rating date not available";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Turns FSA's condensed status strings (e.g. "AwaitingInspection") into readable text
 * ("Awaiting Inspection"). Already-spaced values (typical for FHIS) pass through
 * unchanged.
 */
export function humanizeStatus(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
