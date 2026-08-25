"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, fetchBusinessTypes, searchEstablishments, searchNearby } from "@/lib/api-client";
import { EstablishmentMap, type MapPoint } from "@/components/EstablishmentMap";
import { RatingBadge } from "@/components/RatingBadge";
import { formatAddress, formatDate } from "@/lib/format";
import { establishmentPath } from "@/lib/slug";
import type { BusinessType, Establishment, PaginationMeta } from "@/lib/types";

const RADIUS_OPTIONS_MILES = [0.5, 1, 2, 5, 10];
const DEFAULT_RADIUS_MILES = "2";
const DEFAULT_SORT = "name";
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "name", label: "Name (A-Z)" },
  { value: "rating_desc", label: "Rating (best first)" },
  { value: "rating_asc", label: "Rating (worst first)" },
];
// FHRS's 0-5 scale, newest/best first — used for the quick rating filter chips. FHIS
// establishments (Scotland's Pass / Improvement Required) aren't covered by these chips
// since they're a small minority of the dataset and don't fit the same scale; they're
// still reachable via the ordinary search filters.
const RATING_CHIPS = ["5", "4", "3", "2", "1", "0"];

// A search result, optionally annotated with distanceMiles when it came from the
// "near me" (nearby) endpoint rather than the name/postcode/type search endpoint.
type ResultItem = Establishment & { distanceMiles?: number };

function toMapPoints(results: ResultItem[]): MapPoint[] {
  return results
    .filter((result): result is Establishment & { latitude: number; longitude: number } => result.latitude !== null && result.longitude !== null)
    .map((result) => ({
      id: result.id,
      lat: result.latitude,
      lng: result.longitude,
      label: result.businessName,
      href: establishmentPath(result.fhrsId, result.businessName),
    }));
}

// Normalizes the current URL search params into the exact query string that will be
// sent to the search API (defaulting page to 1), used both as the effect dependency
// and as a stable "request key" for deriving loading/success/error state.
function buildSearchKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString());
  if (!params.has("page")) params.set("page", "1");
  return params.toString();
}

// The homepage deliberately shows nothing (just the form + an empty map) until the
// visitor actually searches for something — no fetch happens, and no arbitrary slice
// of the 600k+ establishments gets rendered, until at least one real filter is present.
// A "near me" search (lat+lng) counts as a filter in exactly the same way.
function hasActiveFilters(searchParams: URLSearchParams): boolean {
  return Boolean(
    searchParams.get("name")?.trim() ||
      searchParams.get("postcode")?.trim() ||
      searchParams.get("businessTypeId") ||
      isNearbySearch(searchParams),
  );
}

function isNearbySearch(searchParams: URLSearchParams): boolean {
  return Boolean(searchParams.get("lat") && searchParams.get("lng"));
}

type SearchRequestState =
  | { key: string; status: "idle" }
  | { key: string; status: "loading" }
  | { key: string; status: "success"; data: ResultItem[]; pagination: PaginationMeta }
  | { key: string; status: "error"; message: string };

interface SearchPageContentProps {
  /** ISO timestamp of the most recent FSA data sync, or null if it couldn't be determined. */
  lastSyncedAt: string | null;
}

export function SearchPageContent({ lastSyncedAt }: SearchPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);

  // Form fields are seeded from the URL so the form reflects the active search
  // (and stays correct across back/forward navigation). Rather than syncing them via
  // an effect, we compare the URL's current query key against the key that produced
  // the current field values, and adjust state during render when they diverge — the
  // React-recommended pattern for "adjusting state when a prop changes" without
  // triggering an extra effect-driven render pass.
  const formSyncKey = searchParams.toString();
  const [syncedFormKey, setSyncedFormKey] = useState(formSyncKey);
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [postcode, setPostcode] = useState(searchParams.get("postcode") ?? "");
  const [businessTypeId, setBusinessTypeId] = useState(searchParams.get("businessTypeId") ?? "");
  if (syncedFormKey !== formSyncKey) {
    setSyncedFormKey(formSyncKey);
    setName(searchParams.get("name") ?? "");
    setPostcode(searchParams.get("postcode") ?? "");
    setBusinessTypeId(searchParams.get("businessTypeId") ?? "");
  }

  // Same "derive during render" approach for the search results themselves: as soon as
  // the URL's search key changes, the request state flips to "loading" (or "idle", if
  // there's nothing to search for yet) for that new key during render, and the effect
  // below only ever calls setState from within its async .then/.catch callbacks (never
  // synchronously in the effect body).
  const searchKey = buildSearchKey(searchParams);
  const hasFilters = hasActiveFilters(searchParams);
  const isNearbyMode = isNearbySearch(searchParams);
  const [requestState, setRequestState] = useState<SearchRequestState>({
    key: searchKey,
    status: hasFilters ? "loading" : "idle",
  });
  if (requestState.key !== searchKey) {
    setRequestState({ key: searchKey, status: hasFilters ? "loading" : "idle" });
  }

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasFilters) return;

    let cancelled = false;
    const params = new URLSearchParams(searchKey);
    const request = isNearbyMode ? searchNearby(params) : searchEstablishments(params);

    request
      .then((response) => {
        if (cancelled) return;
        setRequestState({ key: searchKey, status: "success", data: response.data, pagination: response.pagination });
      })
      .catch((err) => {
        if (cancelled) return;
        setRequestState({
          key: searchKey,
          status: "error",
          message: err instanceof ApiError ? err.message : "Something went wrong while searching. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [searchKey, hasFilters, isNearbyMode]);

  useEffect(() => {
    let cancelled = false;
    fetchBusinessTypes()
      .then((response) => {
        if (!cancelled) setBusinessTypes(response.data);
      })
      .catch(() => {
        // Non-critical: the dropdown just stays empty if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (postcode.trim()) params.set("postcode", postcode.trim());
    if (businessTypeId) params.set("businessTypeId", businessTypeId);
    // Carry over the rating filter/sort refinements across a fresh text search, so
    // tweaking the name/postcode/type fields doesn't silently discard them.
    const ratingValue = searchParams.get("ratingValue");
    const sort = searchParams.get("sort");
    if (ratingValue) params.set("ratingValue", ratingValue);
    if (sort && sort !== DEFAULT_SORT) params.set("sort", sort);
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  // Rating chips and sort only apply to the name/postcode/type search endpoint, not the
  // nearby (distance-sorted) one — both are no-ops in nearby mode since the params are
  // simply dropped when "Search near me" replaces the URL wholesale.
  function setRatingValue(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("ratingValue", value);
    else params.delete("ratingValue");
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  function setSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === DEFAULT_SORT) params.delete("sort");
    else params.set("sort", sort);
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/?${params.toString()}`);
  }

  // Switches into "near me" mode: replaces whatever text-based search was active with a
  // radius search centred on the browser's reported position. Kept as its own mode
  // (rather than layering onto the name/postcode form) since the nearby endpoint doesn't
  // support those filters — the two search modes are mutually exclusive in the URL.
  function handleUseLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Location isn't supported by this browser.");
      return;
    }
    setLocationError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const params = new URLSearchParams();
        params.set("lat", position.coords.latitude.toFixed(5));
        params.set("lng", position.coords.longitude.toFixed(5));
        params.set("radiusMiles", DEFAULT_RADIUS_MILES);
        params.set("page", "1");
        router.push(`/?${params.toString()}`);
      },
      (geoError) => {
        setLocating(false);
        setLocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location access was denied — enable it in your browser settings to use this."
            : "Couldn't determine your location. Please try again.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  }

  function setRadiusMiles(radiusMiles: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("radiusMiles", radiusMiles);
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  function clearLocation() {
    setLocationError(null);
    router.push("/");
  }

  const formattedSyncDate = formatDate(lastSyncedAt);

  const isIdle = requestState.status === "idle";
  const isLoading = requestState.status === "loading";
  const results = requestState.status === "success" ? requestState.data : [];
  const pagination = requestState.status === "success" ? requestState.pagination : null;
  const error = requestState.status === "error" ? requestState.message : null;
  const mapPoints = toMapPoints(results);

  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-600 to-blue-600 pt-10 pb-16 sm:pt-14 sm:pb-20">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Find food hygiene ratings near you
          </h1>
          <p className="mt-3 max-w-2xl text-indigo-100">
            Search official Food Standards Agency ratings for restaurants, takeaways, cafes, shops and more —
            by name, postcode, or business type.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-indigo-100">
            <HeroStat label="Official FSA data" />
            <HeroStat label={formattedSyncDate ? `Data updated ${formattedSyncDate}` : "Updated regularly"} />
            <HeroStat label="600,000+ UK establishments" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-8">
        <form
          onSubmit={handleSubmit}
          className="-mt-10 mb-8 grid grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-lg shadow-gray-900/5 sm:-mt-12 sm:grid-cols-4 sm:p-5"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Business name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Old Bakery"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="postcode" className="text-sm font-medium text-gray-700">
              Postcode
            </label>
            <input
              id="postcode"
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. SW1A 1AA"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="businessTypeId" className="text-sm font-medium text-gray-700">
              Business type
            </label>
            <select
              id="businessTypeId"
              value={businessTypeId}
              onChange={(e) => setBusinessTypeId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            >
              <option value="">All types</option>
              {businessTypes.map((type) => (
                <option key={type.businessTypeId} value={type.businessTypeId}>
                  {type.businessType}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Search
            </button>
          </div>
        </form>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c-4.5-4.2-7-7.9-7-11a7 7 0 1114 0c0 3.1-2.5 6.8-7 11z" />
              <circle cx="12" cy="10" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {locating ? "Finding you…" : "Search near me"}
          </button>

          {isNearbyMode && (
            <>
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                Within
                <select
                  value={searchParams.get("radiusMiles") ?? DEFAULT_RADIUS_MILES}
                  onChange={(e) => setRadiusMiles(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                >
                  {RADIUS_OPTIONS_MILES.map((mi) => (
                    <option key={mi} value={mi}>
                      {mi} mi
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={clearLocation} className="text-sm font-medium text-indigo-600 hover:underline">
                Clear location
              </button>
            </>
          )}

          {locationError && <p className="text-sm text-red-600">{locationError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            {error && (
              <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {!isIdle && !isNearbyMode && (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm text-gray-600">
                  Sort by
                  <select
                    value={searchParams.get("sort") ?? DEFAULT_SORT}
                    onChange={(e) => setSort(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm text-gray-600">Rating:</span>
                  <button
                    type="button"
                    onClick={() => setRatingValue(null)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      !searchParams.get("ratingValue")
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    All
                  </button>
                  {RATING_CHIPS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRatingValue(value)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        searchParams.get("ratingValue") === value
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isIdle ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-700">Search to see results</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Enter a business name, postcode, or business type above — or use &ldquo;Search near me&rdquo; —
                    to find food hygiene ratings.
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <p className="text-sm text-gray-500">Loading results…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-gray-500">
                No establishments found.{" "}
                {isNearbyMode ? "Try a wider radius." : "Try adjusting your search."}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link
                      href={establishmentPath(result.fhrsId, result.businessName)}
                      className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">{result.businessName}</p>
                          <p className="mt-0.5 text-sm text-gray-500">{result.businessType}</p>
                          <p className="mt-1 text-sm text-gray-600">{formatAddress(result)}</p>
                          {typeof result.distanceMiles === "number" && (
                            <p className="mt-1 text-xs font-medium text-indigo-600">
                              {result.distanceMiles.toFixed(1)} mi away
                            </p>
                          )}
                        </div>
                        <RatingBadge
                          schemeType={result.schemeType}
                          ratingValue={result.ratingValue}
                          ratingDate={result.ratingDate}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row">
                <button
                  type="button"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-center text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} results)
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <EstablishmentMap points={mapPoints} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg className="h-4 w-4 text-indigo-200" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {label}
    </span>
  );
}
