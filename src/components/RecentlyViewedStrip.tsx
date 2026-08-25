"use client";

import Link from "next/link";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { RatingBadge } from "@/components/RatingBadge";
import { establishmentPath } from "@/lib/slug";

// A horizontally-scrolling strip of establishment pages the visitor has looked at
// recently (see src/lib/recently-viewed.ts) — shown on the homepage before a search is
// run, so returning visitors have somewhere to go besides typing a fresh query. Renders
// nothing until at least one establishment page has been viewed on this browser.
export function RecentlyViewedStrip() {
  const recentlyViewed = useRecentlyViewed();
  if (recentlyViewed.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Recently viewed</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {recentlyViewed.map((entry) => (
          <Link
            key={entry.fhrsId}
            href={establishmentPath(entry.fhrsId, entry.businessName)}
            className="flex w-56 shrink-0 flex-col justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{entry.businessName}</p>
              <p className="mt-0.5 truncate text-xs text-gray-500">{entry.businessType}</p>
            </div>
            <RatingBadge schemeType={entry.schemeType} ratingValue={entry.ratingValue} ratingDate={entry.ratingDate} />
          </Link>
        ))}
      </div>
    </div>
  );
}
