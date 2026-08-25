import type { MetadataRoute } from "next";
import { ESTABLISHMENT_SITEMAP_SHARD_SIZE, getEstablishmentSitemapShardCount } from "@/lib/establishment-sitemap";
import { prisma } from "@/lib/prisma";
import { establishmentPath } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Splits the ~600k-establishment long tail across many small sitemaps (Google's limit is
// 50,000 URLs/file) — separate from the single bounded top-N subset in the root
// sitemap.ts (see that file's own comment for why it doesn't attempt this itself). Each
// shard id maps to a stable, ordered slice (ORDER BY fhrsId, which is @unique-indexed) so
// shard contents stay consistent between the id list here and each shard's own query.
// These shard URLs aren't nested inside the root sitemap.xml — Next.js doesn't support
// that — so robots.ts lists each one directly via its own `Sitemap:` line instead.
export async function generateSitemaps() {
  const shardCount = await getEstablishmentSitemapShardCount();
  return Array.from({ length: shardCount }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const shardId = Number(await id);
  const establishments = await prisma.establishment.findMany({
    where: { isActive: true },
    select: { fhrsId: true, businessName: true, updatedAt: true },
    orderBy: { fhrsId: "asc" },
    skip: shardId * ESTABLISHMENT_SITEMAP_SHARD_SIZE,
    take: ESTABLISHMENT_SITEMAP_SHARD_SIZE,
  });

  return establishments.map((establishment) => ({
    url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`,
    lastModified: establishment.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.3,
  }));
}
