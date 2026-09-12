import Link from "next/link";
import { getBusinessCategoryByTypeId } from "@/lib/business-categories";
import type { CompanyInfo, EstablishmentDetailData } from "@/lib/establishment-detail";
import { formatAddress, formatDate, formatRatingDate, humanizeStatus } from "@/lib/format";
import { getLocalAuthorityByName } from "@/lib/local-authorities";
import { getRatingBand, getRatingMeaning } from "@/lib/rating-scale";
import type { RatingTrajectory } from "@/lib/rating-trajectory";
import { establishmentPath } from "@/lib/slug";
import type { Establishment, NearbyEstablishmentSummary, OtherLocation, RatingHistoryEntry } from "@/lib/types";
import { RatingBadge } from "@/components/RatingBadge";

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

// A left-edge accent stripe on the hero card, echoing the same red/amber/green
// categorisation as RatingBadge — a quick at-a-glance cue before you've even read the
// badge text.
const ACCENT_CLASSES = {
  green: "border-l-green-400",
  amber: "border-l-amber-400",
  red: "border-l-red-400",
  gray: "border-l-gray-300",
} as const;

function ratingAccentClasses(schemeType: string, ratingValue: string): string {
  return ACCENT_CLASSES[getRatingBand(schemeType, ratingValue)];
}

export function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-indigo-600 hover:underline"
    >
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

// A one-line, rating-specific explainer — what this establishment's actual score means,
// in plain English, rather than just the bare badge. Pulled from the shared rating-scale
// copy (see src/lib/rating-scale.ts) so it can't say something different from the About
// page's own reference table. Renders nothing for a value that doesn't match either scale
// (e.g. "Awaiting Publication") rather than guessing at a meaning.
function RatingMeaningNote({ schemeType, ratingValue }: { schemeType: string; ratingValue: string }) {
  const meaning = getRatingMeaning(schemeType, ratingValue);
  if (!meaning) return null;

  return <p className="mt-3 text-sm text-gray-700">{meaning}.</p>;
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

// A one-line comparison against the average FHRS rating for the same business type within
// ~3 miles — a narrower, more like-for-like comparison than the local-authority-wide
// average above (see getNearbyBusinessTypeAverageRating).
function NearbyTypeAverageNote({
  ratingValue,
  average,
  businessType,
}: {
  ratingValue: number;
  average: number;
  businessType: string;
}) {
  const diff = ratingValue - average;
  const comparison =
    Math.abs(diff) < 0.05
      ? `matches the average of ${average.toFixed(1)}`
      : diff > 0
        ? `above the average of ${average.toFixed(1)}`
        : `below the average of ${average.toFixed(1)}`;

  return (
    <p className="mt-1 text-xs text-gray-500">
      It&apos;s {comparison} for {businessType.toLowerCase()} within 3 miles.
    </p>
  );
}

// A heads-up when the last inspection was over ~2 years ago — the badge above still shows
// the last published rating, but it's worth being upfront that it may no longer reflect
// current standards. See computeRatingTrajectory in src/lib/rating-trajectory.ts.
function StaleInspectionNote({ daysSinceLastInspection }: { daysSinceLastInspection: number }) {
  const years = Math.floor(daysSinceLastInspection / 365);
  const yearsText = years >= 1 ? `${years} year${years === 1 ? "" : "s"}` : `${daysSinceLastInspection} days`;

  return (
    <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      It&apos;s been over {yearsText} since the last inspection — standards may have changed since then.
    </p>
  );
}

// A one-line summary of the direction of travel ("Improved from 3/5 to 5/5" or "Rated 5/5
// for the last 3 inspections in a row"), built from the same derived data as the timeline
// below rather than restating it — see computeRatingTrajectory.
function TrajectorySummary({ trajectory, currentLabel }: { trajectory: RatingTrajectory; currentLabel: string }) {
  if (trajectory.direction && trajectory.previousRatingLabel) {
    const verb = trajectory.direction === "improved" ? "Improved" : "Declined";
    const streak =
      trajectory.consecutiveAtCurrentRating > 1 ? `, and has held for ${trajectory.consecutiveAtCurrentRating} inspections since` : "";
    return (
      <p className="text-xs text-gray-500">
        {verb} from {trajectory.previousRatingLabel} to {currentLabel}
        {streak}.
      </p>
    );
  }

  if (trajectory.consecutiveAtCurrentRating > 1) {
    return (
      <p className="text-xs text-gray-500">
        Rated {currentLabel} for the last {trajectory.consecutiveAtCurrentRating} inspections in a row.
      </p>
    );
  }

  return null;
}

// A short "improved/declined/steady" timeline built from RatingHistory rows. Only rendered
// when there's more than one entry — a single entry is just the establishment's first-seen
// rating and isn't a "history" yet.
export function RatingHistorySection({ history, trajectory }: { history: RatingHistoryEntry[]; trajectory: RatingTrajectory }) {
  if (history.length < 2) return null;

  const current = history[0];
  const currentLabel =
    current.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(current.ratingValue)
      ? `${current.ratingValue}/5`
      : humanizeStatus(current.ratingValue);

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Rating history</h2>
      <div className="mt-1">
        <TrajectorySummary trajectory={trajectory} currentLabel={currentLabel} />
      </div>
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

// A "trading since" fact sourced from Companies House (see scripts/match-companies-house.ts)
// — only rendered for HIGH/MEDIUM-confidence matches (LOW-confidence matches are stored for
// analysis but never surfaced here). Deliberately shows only the incorporation date, not
// company status: a MEDIUM-confidence match is occasionally the wrong company, and a status
// like "Dissolved" sitting next to an establishment the FSA lists as active would read as a
// confusing, possibly wrong claim about a real business — the incorporation date alone is a
// safe, low-risk fact even when the match is imperfect. Links through to the real Companies
// House filing so the claim is independently checkable.
function CompanyInfoNote({ company }: { company: CompanyInfo }) {
  const incorporated = formatDate(company.incorporationDate);
  if (!incorporated) return null;

  return (
    <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500">
      Trading since {incorporated}, per{" "}
      <a
        href={`https://find-and-update.company-information.service.gov.uk/company/${company.companyNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:underline"
      >
        Companies House
      </a>
      .
    </p>
  );
}

// Other active establishments within a mile, nearest first — server-rendered from our own
// database (see getEstablishmentDetailData) rather than the client-fetched widget this
// replaced, since this data isn't FSA-live-API-dependent and benefits from the same
// crawlability fix as the rest of the page.
export function NearbyEstablishmentsSection({ items }: { items: NearbyEstablishmentSummary[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-gray-900">Other places nearby</h2>
      {/* The fade is a static edge cue (not scroll-aware — that'd need a client component)
          that there's more to scroll, since the list otherwise just clips mid-card with no
          visual hint. Right-fade only, since the list always starts scrolled to the left. */}
      <div className="relative mt-3">
        <ul className="flex gap-3 overflow-x-auto pb-2">
          {items.map((item) => (
            <li key={item.id} className="w-56 shrink-0">
              <Link
                href={establishmentPath(item.fhrsId, item.businessName)}
                className="block h-full rounded-xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <p className="line-clamp-2 text-sm font-semibold text-gray-900">{item.businessName}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{formatAddress(item)}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-indigo-600">{item.distanceMiles.toFixed(1)} mi away</span>
                  <RatingBadge schemeType={item.schemeType} ratingValue={item.ratingValue} ratingDate={item.ratingDate} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-gray-50 to-transparent"
          aria-hidden
        />
      </div>
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
  const {
    establishment,
    localAuthorityAverageRating,
    nearbyBusinessTypeAverageRating,
    ratingHistory,
    otherLocations,
    trajectory,
    company,
  } = detail;
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
          <div className="text-left sm:text-right">
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
            {isNumericFhrs && nearbyBusinessTypeAverageRating !== null && (
              <NearbyTypeAverageNote
                ratingValue={Number(establishment.ratingValue)}
                average={nearbyBusinessTypeAverageRating}
                businessType={establishment.businessType}
              />
            )}
          </div>
        </div>

        <RatingMeaningNote schemeType={establishment.schemeType} ratingValue={establishment.ratingValue} />
        {trajectory.staleInspection && trajectory.daysSinceLastInspection !== null && (
          <StaleInspectionNote daysSinceLastInspection={trajectory.daysSinceLastInspection} />
        )}

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

        {company && <CompanyInfoNote company={company} />}
      </div>

      <RatingHistorySection history={ratingHistory} trajectory={trajectory} />
      <OtherLocationsSection locations={otherLocations} />
    </>
  );
}
