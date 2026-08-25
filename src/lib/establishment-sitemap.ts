import { prisma } from "@/lib/prisma";

// Google's sitemap limit is 50,000 URLs per file — shard at a safe margin under that so a
// day's worth of newly-active establishments never tips a shard over the limit before the
// next regeneration. Shared between the sitemap shard generator and robots.ts (which needs
// to know how many shard URLs to list) so the two never drift out of sync.
export const ESTABLISHMENT_SITEMAP_SHARD_SIZE = 45000;

export async function getEstablishmentSitemapShardCount(): Promise<number> {
  const count = await prisma.establishment.count({ where: { isActive: true } });
  return Math.ceil(count / ESTABLISHMENT_SITEMAP_SHARD_SIZE);
}
