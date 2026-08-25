// Curated groupings of the FSA's businessTypeId values, used to build "best rated
// [category] in [area]" pages (see src/app/area/[slug]/[category]/page.tsx).
//
// The FSA feed has 14 raw business types, but several are back-of-house/wholesale
// businesses (distributors, importers, farmers, manufacturers) that nobody searches
// "best rated" for — deliberately left out of this list rather than forced into a
// category, so they're still reachable via the main search filter but don't get a
// dedicated landing page. This also keeps the area/category page combinations to a
// manageable, genuinely useful set instead of a combinatorial explosion of thin pages.
export interface BusinessCategory {
  slug: string;
  label: string;
  /** Plural, lowercase — used mid-sentence, e.g. "best rated {pluralLabel} in Leeds". */
  pluralLabel: string;
  businessTypeIds: number[];
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { slug: "restaurants-cafes", label: "Restaurants & Cafes", pluralLabel: "restaurants and cafes", businessTypeIds: [1] },
  { slug: "takeaways", label: "Takeaways", pluralLabel: "takeaways", businessTypeIds: [7844] },
  { slug: "pubs-bars", label: "Pubs & Bars", pluralLabel: "pubs and bars", businessTypeIds: [7843] },
  { slug: "hotels-guest-houses", label: "Hotels & Guest Houses", pluralLabel: "hotels and guest houses", businessTypeIds: [7842] },
  { slug: "supermarkets-shops", label: "Supermarkets & Shops", pluralLabel: "supermarkets and shops", businessTypeIds: [4613, 7840] },
  { slug: "schools-colleges", label: "Schools & Colleges", pluralLabel: "schools and colleges", businessTypeIds: [7845] },
  { slug: "care-hospitals", label: "Care Homes & Hospitals", pluralLabel: "care homes and hospitals", businessTypeIds: [5] },
  { slug: "mobile-caterers", label: "Mobile Caterers", pluralLabel: "mobile caterers", businessTypeIds: [7846] },
];

const BY_SLUG = new Map(BUSINESS_CATEGORIES.map((c) => [c.slug, c]));

export function getBusinessCategoryBySlug(slug: string): BusinessCategory | null {
  return BY_SLUG.get(slug) ?? null;
}
