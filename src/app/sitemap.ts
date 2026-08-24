import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Only the search page is listed here — with 600k+ establishments, enumerating every
// /establishment/[id] page would mean generating (and keeping in sync with the sync
// script) a huge sitemap for very little SEO benefit. Search engines can still crawl
// individual establishment pages via links from the search page itself.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
