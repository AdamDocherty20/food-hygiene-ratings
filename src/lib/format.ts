import type { Establishment, EstablishmentSummary } from "@/lib/types";

/**
 * Extracts just the fields needed for a compact summary card — used to build the entries
 * stored in the client-side "saved" and "recently viewed" lists (see
 * src/lib/saved-establishments.ts and src/lib/recently-viewed.ts).
 */
export function toEstablishmentSummary(establishment: Establishment): EstablishmentSummary {
  return {
    fhrsId: establishment.fhrsId,
    businessName: establishment.businessName,
    businessType: establishment.businessType,
    addressLine1: establishment.addressLine1,
    postcode: establishment.postcode,
    ratingValue: establishment.ratingValue,
    schemeType: establishment.schemeType,
    ratingDate: establishment.ratingDate,
  };
}

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
 * Shared "25 August 2026"-style formatter — used by formatRatingDate below and by the
 * homepage's data-freshness indicator, so every date in the app reads the same way.
 * Returns null (rather than a placeholder string) for missing/invalid input, leaving the
 * choice of fallback copy to the caller.
 */
export function formatDate(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Rating dates are shown next to every rating in the app (a legal requirement of the
 * FSA/OGL attribution terms, not just a UX nicety) — this is the single place that
 * formatting lives so every usage stays consistent.
 */
export function formatRatingDate(ratingDate: string | null): string {
  return formatDate(ratingDate) ?? "Rating date not available";
}

/**
 * Turns FSA's condensed status strings (e.g. "AwaitingInspection") into readable text
 * ("Awaiting Inspection"). Already-spaced values (typical for FHIS) pass through
 * unchanged.
 */
export function humanizeStatus(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
