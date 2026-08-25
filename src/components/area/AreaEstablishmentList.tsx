import Link from "next/link";
import { RatingBadge } from "@/components/RatingBadge";
import type { AreaEstablishment } from "@/lib/area-queries";
import { formatAddress } from "@/lib/format";
import { establishmentPath } from "@/lib/slug";

/**
 * Shared result-card grid for the /area landing pages — deliberately mirrors the search
 * page's own card styling (see SearchPageContent.tsx) so establishments look the same
 * whether a visitor arrives via search or via one of these curated pages.
 */
export function AreaEstablishmentList({ establishments }: { establishments: AreaEstablishment[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {establishments.map((establishment) => (
        <li key={establishment.fhrsId}>
          <Link
            href={establishmentPath(establishment.fhrsId, establishment.businessName)}
            className="block h-full rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
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
