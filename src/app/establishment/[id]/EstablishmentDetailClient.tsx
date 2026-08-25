"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, fetchEstablishment } from "@/lib/api-client";
import { EstablishmentMap, type MapPoint } from "@/components/EstablishmentMap";
import { NearbyEstablishments } from "@/components/NearbyEstablishments";
import { RatingBadge } from "@/components/RatingBadge";
import { ShareButton } from "@/components/ShareButton";
import { formatAddress, formatRatingDate, humanizeStatus } from "@/lib/format";
import { establishmentPath, parseFhrsIdParam } from "@/lib/slug";
import type { Establishment, EstablishmentDetailResponse, FsaDetail } from "@/lib/types";

type RequestState =
  | { fhrsId: string; status: "loading" }
  | { fhrsId: string; status: "success"; data: EstablishmentDetailResponse }
  | { fhrsId: string; status: "error"; message: string };

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

function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to search
    </Link>
  );
}

// Home › local authority › business type › business name — the first three levels link
// back into a filtered search, the last is the current page (not a link). Doubles as a
// small SEO/internal-linking boost since every establishment page fans back out to two
// filtered search views.
function Breadcrumbs({ establishment }: { establishment: Establishment }) {
  return (
    <nav aria-label="Breadcrumb" className="mt-3 flex flex-wrap items-center gap-1 text-xs text-gray-500">
      <Link href="/" className="hover:text-indigo-600 hover:underline">
        Home
      </Link>
      <span aria-hidden>›</span>
      <Link
        href={`/?localAuthorityName=${encodeURIComponent(establishment.localAuthorityName)}`}
        className="hover:text-indigo-600 hover:underline"
      >
        {establishment.localAuthorityName}
      </Link>
      <span aria-hidden>›</span>
      <Link
        href={`/?businessTypeId=${establishment.businessTypeId}`}
        className="hover:text-indigo-600 hover:underline"
      >
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
function DirectionsLink({ lat, lng }: { lat: number; lng: number }) {
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
// getLocalAuthorityAverageRating in the API route; FHIS's pass/fail scale has no numeric
// average to compare against).
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
function RatingHistorySection({ history }: { history: EstablishmentDetailResponse["ratingHistory"] }) {
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
function OtherLocationsSection({ locations }: { locations: EstablishmentDetailResponse["otherLocations"] }) {
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

// The FHRS component score breakdown, fetched live from the FSA (not in the bulk feed
// scripts/sync.ts imports, so it isn't in our own database). Counterintuitively, lower is
// better on all three — 0 is the best possible score — so we spell that out rather than
// letting a "5" read as a good number the way the overall rating does.
function ScoreBreakdown({ scores }: { scores: NonNullable<FsaDetail["scores"]> }) {
  const rows: { label: string; value: number }[] = [
    { label: "Hygienic food handling", value: scores.hygiene },
    { label: "Cleanliness of facilities", value: scores.structural },
    { label: "Confidence in management", value: scores.confidenceInManagement },
  ];

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Inspection score breakdown</h2>
      <p className="mt-1 text-xs text-gray-500">
        Lower scores are better — 0 is the best possible score on each measure.
      </p>
      <dl className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-gray-600">{row.label}</dt>
            <dd className="font-medium text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// FSA-supplied extras that aren't in our own database: the business's written response to
// its inspection (if any) and a phone number. Renders nothing for whichever fields are
// missing, and the whole section is skipped by the caller if fsaDetail is null altogether
// (e.g. the FSA's live API timed out).
function FsaExtrasSection({ fsaDetail }: { fsaDetail: FsaDetail }) {
  if (!fsaDetail.phone && !fsaDetail.rightToReply && !fsaDetail.scores) return null;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {(fsaDetail.phone || fsaDetail.rightToReply) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {fsaDetail.phone && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Phone</h2>
              <a href={`tel:${fsaDetail.phone}`} className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
                {fsaDetail.phone}
              </a>
            </div>
          )}
          {fsaDetail.phone && fsaDetail.rightToReply && <hr className="my-4 border-gray-100" />}
          {fsaDetail.rightToReply && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Business&apos;s response</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{fsaDetail.rightToReply}</p>
            </div>
          )}
        </div>
      )}
      {fsaDetail.scores && <ScoreBreakdown scores={fsaDetail.scores} />}
    </div>
  );
}

// A heads-up that a re-inspection has already taken place but the FSA hasn't published the
// new rating yet — the rating shown below is the last published one, not necessarily the
// current one.
function NewRatingPendingBanner() {
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      A new inspection has taken place — this rating may be out of date until the FSA publishes the result.
    </p>
  );
}

export function EstablishmentDetailClient() {
  const router = useRouter();
  // The route segment is "[fhrsId]-[slug]" (e.g. "1954128-nosh") or, for old links, just
  // the bare fhrsId — the slug is cosmetic, so only the leading digits are ever used to
  // look the establishment up.
  const params = useParams<{ id: string }>();
  const fhrsId = parseFhrsIdParam(params.id);

  // As with the search page, request state is derived during render (rather than reset
  // via a synchronous setState at the top of the effect) whenever the route's fhrsId
  // changes — the effect itself only calls setState from within its async callbacks.
  const [requestState, setRequestState] = useState<RequestState>({ fhrsId, status: "loading" });
  if (requestState.fhrsId !== fhrsId) {
    setRequestState({ fhrsId, status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;

    fetchEstablishment(fhrsId)
      .then((data) => {
        if (!cancelled) setRequestState({ fhrsId, status: "success", data });
      })
      .catch((err) => {
        if (cancelled) return;
        setRequestState({
          fhrsId,
          status: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Something went wrong while loading this establishment. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fhrsId]);

  // Once the business name is known, silently correct the URL to the canonical
  // "id-slug" form — this upgrades old bare-ID bookmarks/links and self-heals a stale
  // slug after a business renames, without ever blocking the page on it.
  useEffect(() => {
    if (requestState.status !== "success") return;
    const canonicalPath = establishmentPath(requestState.data.data.fhrsId, requestState.data.data.businessName);
    if (window.location.pathname !== canonicalPath) {
      router.replace(canonicalPath);
    }
  }, [requestState, router]);

  if (requestState.status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <div className="mt-6 animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-6 w-2/3 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-1/3 rounded bg-gray-100" />
          <div className="mt-6 h-20 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (requestState.status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {requestState.message}
        </div>
      </div>
    );
  }

  const { data: establishment, localAuthorityAverageRating, otherLocations, ratingHistory, fsaDetail } = requestState.data;

  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(establishment.ratingValue);
  const shareText = `${establishment.businessName} — food hygiene rating: ${
    isNumericFhrs ? `${establishment.ratingValue}/5` : humanizeStatus(establishment.ratingValue)
  }`;

  const mapPoints: MapPoint[] =
    establishment.latitude !== null && establishment.longitude !== null
      ? [
          {
            id: establishment.id,
            lat: establishment.latitude,
            lng: establishment.longitude,
            label: establishment.businessName,
            href: establishmentPath(establishment.fhrsId, establishment.businessName),
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <BackLink />
        <div className="flex items-center gap-2">
          {establishment.latitude !== null && establishment.longitude !== null && (
            <DirectionsLink lat={establishment.latitude} lng={establishment.longitude} />
          )}
          <ShareButton title={establishment.businessName} text={shareText} />
        </div>
      </div>

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
            {fsaDetail?.newRatingPending && <NewRatingPendingBanner />}
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

      {mapPoints.length > 0 && (
        <div className="mt-6">
          <EstablishmentMap points={mapPoints} heightClassName="h-[350px]" />
        </div>
      )}

      <RatingHistorySection history={ratingHistory} />
      {fsaDetail && <FsaExtrasSection fsaDetail={fsaDetail} />}
      <OtherLocationsSection locations={otherLocations} />

      {establishment.latitude !== null && establishment.longitude !== null && (
        <NearbyEstablishments
          fhrsId={establishment.fhrsId}
          lat={establishment.latitude}
          lng={establishment.longitude}
        />
      )}
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
