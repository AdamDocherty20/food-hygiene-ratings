import Link from "next/link";
import { RatingBadge } from "@/components/RatingBadge";
import type { AreaEstablishment } from "@/lib/area-queries";
import { getCategoryImagePath } from "@/lib/business-categories";
import { formatAddress } from "@/lib/format";
import { establishmentPath } from "@/lib/slug";

/**
 * Shared result-card grid for the /area landing pages — deliberately mirrors the search
 * page's own card styling (see SearchPageContent.tsx) so establishments look the same
 * whether a visitor arrives via search or via one of these curated pages.
 *
 * The category image at the top of each card is a placeholder (see public/categories/ and
 * getCategoryImagePath) — establishments don't have real photos, so this is a plain <img>
 * of one of 9 fixed stock photos (one per category), not a next/image-optimized per-page
 * render. That's deliberate: Vercel's Image Optimization is a separately metered resource,
 * and this app already hit a Vercel usage limit once this session from a similar per-page
 * cost that looked cheap individually but wasn't at 611k pages — a plain, unoptimized
 * static file carries none of that risk since there are only 9 of them, ever.
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
            <img
              src={getCategoryImagePath(establishment.businessTypeId)}
              alt=""
              className="h-36 w-full object-cover"
              loading="lazy"
              width={800}
              height={600}
            />
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
