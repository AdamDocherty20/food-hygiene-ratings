"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  fetchBusinessTypes,
  searchEstablishments,
  searchNearby,
  searchNearbyMapPoints,
} from "@/lib/api-client";
import { EstablishmentMap, type MapPoint, type SearchThisAreaQuery } from "@/components/EstablishmentMap";
import { RatingBadge } from "@/components/RatingBadge";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";
import { BUSINESS_CATEGORIES, getCategoryImagePath } from "@/lib/business-categories";
import { CUISINES, getCuisineImagePath } from "@/lib/cuisines";
import { formatAddress } from "@/lib/format";
import { LOCAL_AUTHORITIES } from "@/lib/local-authorities";
import { establishmentPath } from "@/lib/slug";
import type { BusinessType, Establishment, PaginationMeta } from "@/lib/types";

const RADIUS_OPTIONS_MILES = [0.5, 1, 2, 5, 10];
const DEFAULT_RADIUS_MILES = "2";
// Matches the server-side cap in /api/establishments/nearby — radius values above this
// get silently clamped down there anyway, so there's no point asking for more.
const MAX_RADIUS_MILES = 10;
// Matches MAP_POINT_LIMIT in /api/establishments/nearby/map — used only for the
// "showing nearest N" caption, not to actually cap anything client-side.
const MAP_POINT_LIMIT = 500;
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
// The "Popular areas" grid shown on the idle homepage — the biggest local authorities by
// establishment count, since those are the places a visitor is most likely to be
// searching from. LOCAL_AUTHORITIES is already static (see local-authorities.ts), so this
// sort/slice only needs to happen once at module load, not on every render.
const POPULAR_AREAS = [...LOCAL_AUTHORITIES].sort((a, b) => b.count - a.count).slice(0, 24);

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

// "Search this area" reports the exact radius needed to cover the visible map, but the
// radius <select> only offers a fixed set of steps — round up to the nearest one that's
// at least as big (falling back to the largest/capped option) so nothing visible on the
// map falls outside the radius that gets searched.
function snapRadiusMiles(radiusMiles: number): string {
  const capped = Math.min(radiusMiles, MAX_RADIUS_MILES);
  const snapped = RADIUS_OPTIONS_MILES.find((option) => option >= capped);
  return String(snapped ?? MAX_RADIUS_MILES);
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
      searchParams.get("localAuthorityName")?.trim() ||
      searchParams.get("cuisine")?.trim() ||
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

export function SearchPageContent() {
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

  // Small + medium screens stack the list above the map, so a wide nearby search means a
  // lot of scrolling to actually see the map — this toggle lets a visitor swap to a
  // full-width map view instead, without affecting the side-by-side desktop layout.
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const nameInputRef = useRef<HTMLInputElement>(null);

  // "/" jumps straight into the business name field, the same shortcut GitHub/Gmail/etc
  // use for "focus search" — skipped while already typing in a field (so it doesn't
  // hijack a literal "/" character in, say, a postcode-adjacent field) or holding a
  // modifier key (so browser/OS shortcuts like Cmd+/ still work normally).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      event.preventDefault();
      nameInputRef.current?.focus();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // The results list is capped to one page (20) at a time, which is fine for a list but
  // means a wide-radius nearby search (especially after "Search this area") would only
  // ever show 20 pins even when hundreds of establishments are in view. This fetches a
  // separate, uncapped-ish (up to MAP_POINT_LIMIT) set of pins for the map alone, keyed
  // on lat/lng/radius only — so paging through the list doesn't re-fetch the whole map.
  const nearbyMapKey = isNearbyMode
    ? `${searchParams.get("lat")}|${searchParams.get("lng")}|${searchParams.get("radiusMiles") ?? DEFAULT_RADIUS_MILES}|${searchParams.get("cuisine") ?? ""}`
    : null;
  const [wideMapPoints, setWideMapPoints] = useState<{ key: string; points: MapPoint[]; truncated: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!nearbyMapKey) return;

    let cancelled = false;
    const params = new URLSearchParams();
    params.set("lat", searchParams.get("lat")!);
    params.set("lng", searchParams.get("lng")!);
    params.set("radiusMiles", searchParams.get("radiusMiles") ?? DEFAULT_RADIUS_MILES);
    const cuisineParam = searchParams.get("cuisine");
    if (cuisineParam) params.set("cuisine", cuisineParam);

    searchNearbyMapPoints(params)
      .then((response) => {
        if (cancelled) return;
        setWideMapPoints({
          key: nearbyMapKey,
          truncated: response.truncated,
          points: response.data.map((row) => ({
            id: row.id,
            lat: row.latitude,
            lng: row.longitude,
            label: row.businessName,
            href: establishmentPath(row.fhrsId, row.businessName),
          })),
        });
      })
      .catch(() => {
        // Non-critical: the map just falls back to the current page's results below.
      });

    return () => {
      cancelled = true;
    };
    // searchParams is read via .get() above, but nearbyMapKey already captures every value that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearbyMapKey]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (postcode.trim()) params.set("postcode", postcode.trim());
    if (businessTypeId) params.set("businessTypeId", businessTypeId);
    // Carry over the rating filter/sort/local-authority refinements across a fresh text
    // search, so tweaking the name/postcode/type fields doesn't silently discard them —
    // e.g. arriving here via the "local authority" link on an establishment page and then
    // typing a name shouldn't drop back to a nationwide search.
    const ratingValue = searchParams.get("ratingValue");
    const sort = searchParams.get("sort");
    const localAuthorityName = searchParams.get("localAuthorityName");
    if (ratingValue) params.set("ratingValue", ratingValue);
    if (sort && sort !== DEFAULT_SORT) params.set("sort", sort);
    if (localAuthorityName) params.set("localAuthorityName", localAuthorityName);
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  function clearLocalAuthority() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("localAuthorityName");
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

  // Fired when the visitor pans/zooms the map themselves and clicks the "Search this
  // area" button that then appears — re-centres the nearby search on wherever they've
  // moved to, with a radius wide enough to cover everything currently on screen (e.g.
  // zooming out from Ingleby Barwick to also see Thornaby brings in its pins too).
  function handleSearchThisArea(query: SearchThisAreaQuery) {
    const params = new URLSearchParams();
    params.set("lat", query.lat.toFixed(5));
    params.set("lng", query.lng.toFixed(5));
    params.set("radiusMiles", snapRadiusMiles(query.radiusMiles));
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  const isIdle = requestState.status === "idle";
  const isLoading = requestState.status === "loading";
  const results = requestState.status === "success" ? requestState.data : [];
  const pagination = requestState.status === "success" ? requestState.pagination : null;
  const error = requestState.status === "error" ? requestState.message : null;
  const hasWideMapPoints = isNearbyMode && wideMapPoints !== null && wideMapPoints.key === nearbyMapKey;
  const mapPoints = hasWideMapPoints ? wideMapPoints!.points : toMapPoints(results);
  const mapPointsTruncated = hasWideMapPoints && wideMapPoints!.truncated;

  return (
    <div>
      <section className="relative overflow-hidden">
        <img
          src="/hero.jpg"
          alt=""
          // The hero photo, unlike the establishment/search-result thumbnails, is the
          // page's likely LCP element — eager-load it at high priority rather than
          // treating it like the lazy-loaded category thumbnails elsewhere.
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />
        <div className="relative mx-auto max-w-5xl px-4 pt-14 pb-20 sm:pt-20 sm:pb-24">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Find food hygiene ratings near you
          </h1>
          <p className="mt-3 max-w-2xl text-gray-100">
            Search official Food Standards Agency ratings for restaurants, takeaways, cafes, shops and more —
            by name, postcode, or business type.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-gray-100">
            <HeroStat label="Official FSA data" />
            <HeroStat label="Updated regularly" />
            <HeroStat label="600,000+ UK establishments" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-8">
        <form
          id="search"
          onSubmit={handleSubmit}
          // relative: the hero section above is `position: relative` (needed for its
          // background photo) — per CSS stacking rules that makes it paint *above* this
          // plain in-flow sibling in their overlapping region regardless of DOM order,
          // which was burying the form's labels under the hero. Making the form itself
          // relative (any z-index, even auto) puts both in the same "positioned" paint
          // step, so DOM order — form after hero — wins and the form shows on top again.
          className="relative -mt-10 mb-8 grid grid-cols-1 gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-lg shadow-gray-900/5 sm:-mt-12 sm:grid-cols-4 sm:p-5"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Business name
            </label>
            <input
              id="name"
              ref={nameInputRef}
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

        {!isIdle && (
          <div className="mb-4 inline-flex rounded-md border border-gray-300 bg-white p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                mobileView === "list" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setMobileView("map")}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                mobileView === "map" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Map
            </button>
          </div>
        )}

        {isIdle ? (
          <HomepageDiscovery />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={mobileView === "map" ? "hidden lg:block" : ""}>
              {error && (
                <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {!isNearbyMode && (
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

                  {searchParams.get("localAuthorityName") && (
                    <button
                      type="button"
                      onClick={clearLocalAuthority}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      In {searchParams.get("localAuthorityName")}
                      <span aria-hidden>✕</span>
                    </button>
                  )}
                </div>
              )}

              {isLoading ? (
                <ResultsSkeleton />
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
                        className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                      >
                        <img
                          src={getCategoryImagePath(result.businessTypeId)}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                          width={80}
                          height={80}
                        />
                        <div className="flex flex-1 items-start justify-between gap-4">
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

            <div className={`lg:sticky lg:top-20 lg:self-start ${mobileView === "list" ? "hidden lg:block" : ""}`}>
              <EstablishmentMap points={mapPoints} onSearchThisArea={isNearbyMode ? handleSearchThisArea : undefined} />
              {mapPointsTruncated && (
                <p className="mt-2 text-xs text-gray-500">
                  Showing the nearest {MAP_POINT_LIMIT} matches on the map. Zoom or search a smaller area to see more.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// The idle homepage — shown instead of the (otherwise empty) list+map layout until the
// visitor actually searches for something. A blank "search to see results" placeholder
// wasted the entire page below the fold; this gives arriving visitors something to browse
// immediately (mirroring how Tripadvisor/SquareMeal/TheFork's homepages work) and gives
// the homepage real, crawlable content and internal links instead of client-only emptiness.
function HomepageDiscovery() {
  return (
    <div className="flex flex-col gap-10">
      <RecentlyViewedStrip />

      <section>
        <h2 className="text-center text-lg font-semibold text-gray-900">Pick your cuisine</h2>
        <p className="mt-1 text-center text-sm text-gray-500">
          Find nearby places serving what you&rsquo;re after — we&rsquo;ll ask for your location on the next page, or show
          top-rated results nationwide if you&rsquo;d rather not share it.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {CUISINES.map((cuisine) => (
            <Link
              key={cuisine.slug}
              href={`/cuisine/${cuisine.slug}`}
              className="flex flex-col items-center gap-2 text-center"
            >
              <img
                src={getCuisineImagePath(cuisine.slug)}
                alt=""
                className="h-24 w-24 rounded-full object-cover shadow-sm ring-1 ring-gray-200 transition group-hover:shadow-md"
                loading="lazy"
                width={200}
                height={200}
              />
              <span className="text-sm font-medium text-gray-900">{cuisine.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900">Browse by category</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BUSINESS_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              // Categories with more than one raw FSA businessTypeId (e.g. supermarkets
              // & shops) collapse to the first for this link — the search form's type
              // filter only supports a single value, same as every other type-filter
              // link in the app (see Breadcrumbs in the establishment page).
              href={`/?businessTypeId=${category.businessTypeIds[0]}`}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <img
                src={`/categories/${category.slug}.jpg`}
                alt=""
                className="h-28 w-full object-cover transition group-hover:scale-105 sm:h-32"
                loading="lazy"
                width={400}
                height={300}
              />
              <p className="p-3 text-sm font-medium text-gray-900">{category.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Popular areas</h2>
          <Link href="/area" className="text-sm font-medium text-indigo-600 hover:underline">
            See all areas
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {POPULAR_AREAS.map((area) => (
            <Link
              key={area.slug}
              href={`/area/${area.slug}`}
              className="text-sm text-gray-600 hover:text-indigo-600 hover:underline"
            >
              {area.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:grid sm:grid-cols-2">
        <img
          src="/categories/restaurants-cafes.jpg"
          alt=""
          className="h-40 w-full object-cover sm:h-full"
          loading="lazy"
          width={600}
          height={400}
        />
        <div className="flex flex-col justify-center p-6">
          <h2 className="text-lg font-semibold text-gray-900">Are you a business owner?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Claim your listing to add photos and details for your business — find it below, then look for
            &ldquo;Claim this business&rdquo; on its page.
          </p>
          <a
            href="#search"
            className="mt-4 inline-flex w-fit items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Find your business
          </a>
        </div>
      </section>
    </div>
  );
}

function HeroStat({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {label}
    </span>
  );
}

function ResultsSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
            </div>
            <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}
