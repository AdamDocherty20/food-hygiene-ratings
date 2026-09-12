// Shared business-name normalisation for matching FSA establishment names against external
// registers (Companies House, Wikidata chains) — one place so the rules can't drift between
// the different matching scripts that all need "is this basically the same name" logic.

const CORPORATE_SUFFIXES = ["LIMITED", "LTD", "PLC", "LLP"];

/**
 * Uppercase, strip punctuation, strip a trailing corporate suffix (LIMITED/LTD/PLC/LLP),
 * strip a leading "THE", and — critically for matching a registered legal name against an
 * FSA trading name — take only the part after a "T/A" / "TRADING AS" marker, since that's
 * the name the public (and the FSA) actually knows the business by.
 */
export function normalizeBusinessName(raw: string): string {
  let name = raw.toUpperCase();

  const tradingAsMatch = name.match(/\bT\/A\b\s*(.+)$/) ?? name.match(/\bTRADING AS\b\s*(.+)$/);
  if (tradingAsMatch) name = tradingAsMatch[1];

  name = name.replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  for (const suffix of CORPORATE_SUFFIXES) {
    if (name.endsWith(` ${suffix}`)) {
      name = name.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }

  if (name.startsWith("THE ")) name = name.slice(4);

  return name.trim();
}
