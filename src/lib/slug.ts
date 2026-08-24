// Builds and parses the human-readable slug appended to establishment URLs, e.g.
// /establishment/1954128-nosh instead of /establishment/1954128.
//
// The fhrsId always leads and is the only part actually used to look up the
// establishment — the slug is purely cosmetic. That means:
//   - old bare-ID links (/establishment/1954128) keep working forever
//   - a stale/mismatched slug (business renamed, or someone hand-edits the URL) never
//     breaks the page, it just gets corrected next time it's visited (see the detail
//     page's canonical-redirect effect)

const DIACRITIC_MARKS = /[̀-ͯ]/g;

// Strips accents/punctuation and collapses whitespace into hyphens. Deliberately loose
// (no attempt to be "pretty" for every possible business name) — this only needs to be
// unique-ish and readable, not perfect.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITIC_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function establishmentPath(fhrsId: number, businessName: string): string {
  const slug = slugify(businessName);
  return `/establishment/${slug ? `${fhrsId}-${slug}` : fhrsId}`;
}

// Pulls the leading integer fhrsId back out of a route param like "1954128-nosh" (or
// just "1954128" for old links / direct id lookups).
export function parseFhrsIdParam(param: string): string {
  return param.match(/^\d+/)?.[0] ?? param;
}
