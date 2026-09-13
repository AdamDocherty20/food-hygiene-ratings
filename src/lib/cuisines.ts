// Cuisine is a dimension the FSA data has no concept of at all — it comes entirely from
// the OpenStreetMap matching work (see scripts/match-osm.ts / OsmMatch in schema.prisma),
// which only covers ~5.8% of active establishments (35,751 of 615,068 as of the last OSM
// sync). That's real but modest coverage — enough for a "near you" browse feature at
// national scale, not enough to promise every establishment has a cuisine tag. The list
// below is deliberately short and popularity-ordered by actual row counts in OsmMatch,
// not an attempt to cover every possible cuisine.
//
// Deliberately no Prisma import in this file — it's imported from client components (the
// homepage's cuisine tile grid), and Prisma Client pulls in Node-only built-ins that break
// the browser bundle if dragged in transitively. The raw-SQL filter builder that DOES need
// Prisma (cuisineFilterSql) lives in cuisine-filter-sql.ts instead, imported only by the
// server-only API routes.
export interface Cuisine {
  slug: string;
  label: string;
  // OSM's `cuisine` tag can hold multiple semicolon-joined values (e.g. "chinese;fish_and_chips"),
  // so matching it needs ILIKE '%word%', not an exact match — see cuisineFilterSql.
  // Vegetarian/vegan are separate OSM tags (diet:vegetarian / diet:vegan), not part of
  // `cuisine` at all, so they match a different column entirely.
  match: { field: "cuisine"; value: string } | { field: "dietVegetarian" | "dietVegan" };
}

export const CUISINES: Cuisine[] = [
  { slug: "pizza", label: "Pizza", match: { field: "cuisine", value: "pizza" } },
  { slug: "chinese", label: "Chinese", match: { field: "cuisine", value: "chinese" } },
  { slug: "indian", label: "Indian", match: { field: "cuisine", value: "indian" } },
  { slug: "italian", label: "Italian", match: { field: "cuisine", value: "italian" } },
  { slug: "thai", label: "Thai", match: { field: "cuisine", value: "thai" } },
  { slug: "vegetarian", label: "Vegetarian", match: { field: "dietVegetarian" } },
  { slug: "vegan", label: "Vegan", match: { field: "dietVegan" } },
  { slug: "seafood", label: "Seafood", match: { field: "cuisine", value: "seafood" } },
];

const BY_SLUG = new Map(CUISINES.map((c) => [c.slug, c]));

export function getCuisineBySlug(slug: string): Cuisine | null {
  return BY_SLUG.get(slug) ?? null;
}

export function getCuisineImagePath(slug: string): string {
  return `/cuisines/${slug}.jpg`;
}
