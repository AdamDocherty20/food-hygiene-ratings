import type { MetadataRoute } from "next";
import { getEstablishmentSitemapShardCount } from "@/lib/establishment-sitemap";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Keeps the JSON API out of search results — it's meant to be consumed by this app's
// own pages, not indexed directly — while leaving the actual site pages crawlable.
export default async function robots(): Promise<MetadataRoute.Robots> {
  // The establishment long-tail sitemap is sharded (see sitemap-establishments/sitemap.ts
  // and its own comment on why) rather than a single file, and Next.js has no built-in way
  // to nest those shard URLs inside the root sitemap.xml — so every shard gets its own
  // `Sitemap:` line here instead. Computed at request time (this route is cached like any
  // other metadata route) so the shard count self-updates as the establishment table grows.
  const shardCount = await getEstablishmentSitemapShardCount();
  const establishmentSitemaps = Array.from(
    { length: shardCount },
    (_, id) => `${SITE_URL}/sitemap-establishments/sitemap/${id}.xml`,
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: [`${SITE_URL}/sitemap.xml`, ...establishmentSitemaps],
  };
}
