import { Suspense } from "react";
import { SearchPageContent } from "@/components/search/SearchPageContent";
import { prisma } from "@/lib/prisma";

// The homepage has no dynamic APIs (no cookies/headers/searchParams), so Next would
// otherwise fully prerender it once at build time and bake in whatever lastSeenAt was
// current then. The FSA sync (.github/workflows/sync.yml) runs daily on its own schedule,
// independent of app deploys, so without revalidation the freshness indicator below would
// silently go stale between deploys. Revalidating hourly keeps it accurate while still
// serving a cached static page for most requests.
export const revalidate = 3600;

// The sync script (scripts/sync.ts) stamps every establishment touched in a run with the
// same lastSeenAt timestamp, so the max across the table is effectively "when did the FSA
// data last get refreshed" — no separate sync-log table needed.
async function getLastSyncedAt(): Promise<string | null> {
  const result = await prisma.establishment.aggregate({ _max: { lastSeenAt: true } });
  return result._max.lastSeenAt ? result._max.lastSeenAt.toISOString() : null;
}

export default async function Home() {
  const lastSyncedAt = await getLastSyncedAt();

  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">Loading…</div>}>
      <SearchPageContent lastSyncedAt={lastSyncedAt} />
    </Suspense>
  );
}
