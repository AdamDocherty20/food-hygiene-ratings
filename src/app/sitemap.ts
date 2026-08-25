import type { MetadataRoute } from "next";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { LOCAL_AUTHORITIES } from "@/lib/local-authorities";
import { prisma } from "@/lib/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// With 600k+ establishments, enumerating every /establishment/[id] page would mean
// generating (and keeping in sync with the sync script) a huge sitemap for very little
// SEO benefit — search engines can still crawl those via links from other pages. The same
// reasoning applies to /area: 361 areas x 8 categories is a lot of mostly-low-traffic
// combinations, so only a bounded, highest-value subset is submitted directly here. The
// long tail is still `robots.txt`-allowed and linked from /area, just not pushed at
// crawlers up front.
const TOP_AREA_COUNT = 40;
const TOP_AREA_CATEGORY_COUNT = 20;

// Only broad categories present in essentially every local authority (restaurants,
// takeaways, pubs) are safe to list for every one of the top areas without checking each
// combination for zero results first — narrower categories (schools, care homes, etc.)
// are more likely to legitimately not exist in a given area and risk submitting a 404'ing
// URL to search engines, so those stay reachable-but-unlisted via the area page itself.
const SITEMAP_SAFE_CATEGORY_SLUGS = new Set(["restaurants-cafes", "takeaways", "pubs-bars"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const topAreas = [...LOCAL_AUTHORITIES].sort((a, b) => b.count - a.count).slice(0, TOP_AREA_COUNT);
  const safeCategories = BUSINESS_CATEGORIES.filter((category) => SITEMAP_SAFE_CATEGORY_SLUGS.has(category.slug));

  // The daily sync updates lastSeenAt on every active row it touches, so the most recent
  // value across the table is effectively "when the data was last refreshed" — a truthful
  // lastModified for these ranking-driven pages, instead of `new Date()` re-stamping every
  // entry as "changed" on every deploy regardless of whether the underlying data moved.
  const latestSync = await prisma.establishment.aggregate({ _max: { lastSeenAt: true }, where: { isActive: true } });
  const lastModified = latestSync._max.lastSeenAt ?? new Date();

  const areaEntries: MetadataRoute.Sitemap = topAreas.map((authority) => ({
    url: `${SITE_URL}/area/${authority.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const categoryEntries: MetadataRoute.Sitemap = topAreas.slice(0, TOP_AREA_CATEGORY_COUNT).flatMap((authority) =>
    safeCategories.map((category) => ({
      url: `${SITE_URL}/area/${authority.slug}/${category.slug}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  );

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/area`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/guide`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    ...areaEntries,
    ...categoryEntries,
  ];
}
