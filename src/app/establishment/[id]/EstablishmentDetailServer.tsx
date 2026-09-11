import Link from "next/link";
import { getBusinessCategoryByTypeId } from "@/lib/business-categories";
import type { EstablishmentDetailData } from "@/lib/establishment-detail";
import { formatAddress, formatRatingDate, humanizeStatus } from "@/lib/format";
import { getLocalAuthorityByName } from "@/lib/local-authorities";
import { establishmentPath } from "@/lib/slug";
import type { Establishment, OtherLocation, RatingHistoryEntry } from "@/lib/types";
import { RatingBadge } from "@/components/RatingBadge";

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

// A left-edge accent stripe on the hero card, echoing the same red/amber/green
// categorisation as RatingBadge — a quick at-a-glance cue before you've even read the
// badge text.
function ratingAccentClasses(schemeType: string, ratingValue: string): string {
  if (schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(ratingValue)) {
    const numeric = Number(ratingValue);
    if (numeric <= 1) return "border-l-red-400";
    if (numeric <= 3) return "border-l-amber-400";
    return "border-l-green-400";
  }
  if (schemeType === "FHIS") {
    const normalized = ratingValue.toLowerCase();
    if (normalized === "pass") return "border-l-green-400";
    if (normalized === "improvement required") return "border-l-amber-400";
  }
  return "border-l-gray-300";
}

export function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to search
    </Link>
  );
}

// Home › local authority › business type › business name — the last is the current page
// (not a link). Where the establishment's local authority/business type have a dedicated
// /area landing page, the first two levels link there instead of a filtered search view —
// that's the page we actually want ranking, so this fans link equity from every
// establishment page back up into it. Falls back to a filtered search link for the
// authorities/types that don't have a landing page (see local-authorities.ts and
// business-categories.ts for why some are excluded).
export function Breadcrumbs({ establishment }: { establishment: Establishment }) {
  const authority = getLocalAuthorityByName(establishment.localAuthorityName);
  const category = getBusinessCategoryByTypeId(establishment.businessTypeId);

  const areaHref = authority
    ? `/area/${authority.slug}`
    : `/?localAuthorityName=${encodeURIComponent(establishment.localAuthorityName)}`;
  const categoryHref =
    authority && category
      ? `/area/${authority.slug}/${category.slug}`
      : `/?businessTypeId=${establishment.businessTypeId}`;

  return (
    <nav aria-label="Breadcrumb" className="mt-3 flex flex-wrap items-center gap-1 text-xs text-gray-500">
      <Link href="/" className="hover:text-indigo-600 hover:underline">
        Home
      </Link>
      <span aria-hidden>›</span>
      <Link href={areaHref} className="hover:text-indigo-600 hover:underline">
        {establishment.localAuthorityName}
      </Link>
      <span aria-hidden>›</span>
      <Link href={categoryHref} className="hover:text-indigo-600 hover:underline">
        {establishment.businessType}
      </Link>
      <span aria-hidden>›</span>
      <span className="truncate text-gray-400">{establishment.businessName}</span>
    </nav>
  );
}

// Deep-links to Google Maps turn-by-turn directions using the establishment's coordinates
// — works cross-platform (opens the Google Maps app on mobile if installed, falls back to
// the web on desktop) without needing an Apple/Google Maps SDK.
export function DirectionsLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      Directions
    </a>
  );
}

// A one-line comparison against the local authority's average FHRS rating — only shown
// for numeric FHRS establishments where we have a comparable average (see
// getLocalAuthorityAverageRating in src/lib/establishment-detail.ts; FHIS's pass/fail
// scale has no numeric average to compare against).
function AverageRatingNote({
  ratingValue,
  average,
  localAuthorityName,
}: {
  ratingValue: number;
  average: number;
  localAuthorityName: string;
}) {
  const diff = ratingValue - average;
  const comparison =
    Math.abs(diff) < 0.05
      ? `matches the average of ${average.toFixed(1)}`
      : diff > 0
        ? `above the average of ${average.toFixed(1)}`
        : `below the average of ${average.toFixed(1)}`;

  return (
    <p className="mt-2 text-xs text-gray-500">
      This rating is {comparison} for{" "}
      <Link href={`/?localAuthorityName=${encodeURIComponent(localAuthorityName)}`} className="text-indigo-600 hover:underline">
        {localAuthorityName}
      </Link>
      .
    </p>
  );
}

// A short "improved/declined/steady" timeline built from RatingHistory rows. Only rendered
// when there's more than one entry — a single entry is just the establishment's first-seen
// rating and isn't a "history" yet.
export function RatingHistorySection({ history }: { history: RatingHistoryEntry[] }) {
  if (history.length < 2) return null;

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Rating history</h2>
      <ol className="mt-4 space-y-3 border-l-2 border-gray-100 pl-4">
        {history.map((entry, index) => (
          <li key={`${entry.recordedAt}-${index}`} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-400" aria-hidden />
            <p className="text-sm font-medium text-gray-900">
              {entry.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(entry.ratingValue)
                ? `${entry.ratingValue}/5`
                : humanizeStatus(entry.ratingValue)}
              {index === 0 && <span className="ml-2 text-xs font-normal text-gray-400">(current)</span>}
            </p>
            <p className="text-xs text-gray-500">
              {entry.ratingDate ? formatRatingDate(entry.ratingDate) : "Inspection date not available"}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Sibling branches sharing the exact business name — a chain's other locations, so a
// visitor comparing branches doesn't have to run a fresh search.
export function OtherLocationsSection({ locations }: { locations: OtherLocation[] }) {
  if (locations.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-gray-900">Other locations</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {locations.map((location) => (
          <li key={location.fhrsId}>
            <Link
              href={establishmentPath(location.fhrsId, location.businessName)}
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{location.businessName}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[location.addressLine1, location.postcode].filter(Boolean).join(", ") || "Address not available"}
                </p>
              </div>
              <RatingBadge schemeType={location.schemeType} ratingValue={location.ratingValue} ratingDate={location.ratingDate} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

// The server-rendered core of the establishment page — name, address, rating, breadcrumb,
// rating history, local-average comparison, other locations. All sourced from our own
// database (see EstablishmentDetailData), so it renders in the initial HTML with no
// client-side fetch required — unlike the FSA-live-API extras (phone, right-to-reply,
// score breakdown), which stay client-fetched in EstablishmentClientExtras.
export function EstablishmentDetailHero({ detail }: { detail: EstablishmentDetailData }) {
  const { establishment, localAuthorityAverageRating, ratingHistory, otherLocations } = detail;
  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(establishment.ratingValue);

  return (
    <>
      <Breadcrumbs establishment={establishment} />

      <div
        className={`mt-4 rounded-xl border border-l-4 border-gray-200 bg-white p-6 shadow-sm ${ratingAccentClasses(establishment.schemeType, establishment.ratingValue)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{establishment.businessName}</h1>
            <Link
              href={`/?businessTypeId=${establishment.businessTypeId}`}
              className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              {establishment.businessType}
            </Link>
          </div>
          <div className="text-right">
            <Link href="/about" title="What does this rating mean?">
              <RatingBadge
                schemeType={establishment.schemeType}
                ratingValue={establishment.ratingValue}
                ratingDate={establishment.ratingDate}
                size="lg"
              />
            </Link>
            {isNumericFhrs && localAuthorityAverageRating !== null && (
              <AverageRatingNote
                ratingValue={Number(establishment.ratingValue)}
                average={localAuthorityAverageRating}
                localAuthorityName={establishment.localAuthorityName}
              />
            )}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 sm:grid-cols-2">
          <InfoRow label="Address" value={formatAddress(establishment)} />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Local authority</dt>
            <dd className="mt-1 text-sm">
              <Link
                href={`/?localAuthorityName=${encodeURIComponent(establishment.localAuthorityName)}`}
                className="text-indigo-600 hover:underline"
              >
                {establishment.localAuthorityName}
              </Link>
            </dd>
          </div>
        </dl>
      </div>

      <RatingHistorySection history={ratingHistory} />
      <OtherLocationsSection locations={otherLocations} />
    </>
  );
}
