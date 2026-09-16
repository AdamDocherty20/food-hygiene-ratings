import Link from "next/link";
import { RatingBadge } from "@/components/RatingBadge";
import type { AreaEstablishment } from "@/lib/area-queries";
import { formatAddress } from "@/lib/format";
import { establishmentPath } from "@/lib/slug";

/**
 * Shared result-card grid for the /area landing pages — deliberately mirrors the search
 * page's own card styling (see SearchPageContent.tsx) so establishments look the same
 * whether a visitor arrives via search or via one of these curated pages.
 *
 * No image here: these lists are filtered to a single category (or area) at a time, so
 * every card would show the exact same category placeholder photo (see
 * getCategoryImagePath) — repeated dozens of times it reads as a bug, not a feature. The
 * per-category placeholder still earns its place as a one-off illustration on the
 * homepage's "Browse by category" tiles (SearchPageContent.tsx), where it appears once
 * per category rather than once per establishment.
 */
export function AreaEstablishmentList({ establishments }: { establishments: AreaEstablishment[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {establishments.map((establishment) => (
        <li key={establishment.fhrsId}>
          <Link
            href={establishmentPath(establishment.fhrsId, establishment.businessName)}
            className="block h-full overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="font-semibold text-gray-900">{establishment.businessName}</p>
                <p className="mt-0.5 text-sm text-gray-500">{establishment.businessType}</p>
                <p className="mt-1 text-sm text-gray-600">{formatAddress(establishment)}</p>
              </div>
              <RatingBadge
                schemeType={establishment.schemeType}
                ratingValue={establishment.ratingValue}
                ratingDate={
                  establishment.ratingDate instanceof Date
                    ? establishment.ratingDate.toISOString()
                    : establishment.ratingDate
                }
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
