"use client";

import { track } from "@vercel/analytics";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompareAreasMap } from "@/components/foodHygieneMap/CompareAreasMap";
import type { FlyToTarget } from "@/components/foodHygieneMap/HygieneMapExplorer";
import { HygieneMapExplorer } from "@/components/foodHygieneMap/HygieneMapExplorer";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { COMPARE_METRICS } from "@/lib/compare-metrics";
import { resolveLocationSearch } from "@/lib/map-search";
import type { MapEstablishmentPoint } from "@/lib/map-types";
import { FHRS_SCALE, FHRS_SCORE_COLOR_CLASSES } from "@/lib/rating-scale";

const RATING_VALUES = ["5", "4", "3", "2", "1", "0"];
type Mode = "explore" | "compare";

function parseListParam(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

function RatingLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
      <span className="font-medium text-gray-700">Rating colours:</span>
      {FHRS_SCALE.map((entry) => (
        <span key={entry.score} className="inline-flex items-center gap-1">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${FHRS_SCORE_COLOR_CLASSES[entry.score]}`}
            aria-hidden
          >
            {entry.score}
          </span>
          {entry.shortLabel}
        </span>
      ))}
    </div>
  );
}

export function FoodHygieneMapClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(() => (searchParams.get("mode") === "compare" ? "compare" : "explore"));
  const [ratings, setRatings] = useState<string[]>(() => parseListParam(searchParams.get("ratings")));
  const [categorySlugs, setCategorySlugs] = useState<string[]>(() => parseListParam(searchParams.get("types")));
  const [metric, setMetric] = useState<string>(() => searchParams.get("metric") || COMPARE_METRICS[0].value);
  const [colorblindMode, setColorblindMode] = useState<boolean>(() => searchParams.get("cb") === "1");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [searchInput, setSearchInput] = useState(() => searchParams.get("location") || "");
  // Separate from `searchInput` (which updates on every keystroke) — this only changes
  // once a search actually succeeds, so it can drive the shareable URL's ?location=
  // param without rewriting the URL on every character typed.
  const [committedLocation, setCommittedLocation] = useState(() => searchParams.get("location") || "");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);

  const initialLocationRef = useRef(searchParams.get("location"));
  const skipNextUrlSyncRef = useRef(true);

  // Memoized so this object's identity only changes when the filters actually do —
  // HygieneMapExplorer's data-fetching effect depends on this whole object, and without
  // memoizing it a fresh {ratings, businessTypeIds} literal on every render (e.g. from
  // typing in the search box) would re-trigger a map-clusters fetch on every keystroke,
  // not just on an actual filter change.
  const businessTypeIds = useMemo(
    () => categorySlugs.flatMap((slug) => BUSINESS_CATEGORIES.find((c) => c.slug === slug)?.businessTypeIds ?? []),
    [categorySlugs],
  );
  const filters = useMemo(() => ({ ratings, businessTypeIds }), [ratings, businessTypeIds]);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    track("map_search", { query });
    try {
      const result = await resolveLocationSearch(query);
      if (!result) {
        setSearchError(`No matches found for "${query}".`);
      } else {
        setFlyTo(result.flyTo);
        setCommittedLocation(query);
      }
    } catch {
      setSearchError("Something went wrong searching — please try again.");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Runs the ?location= seed exactly once on mount, if present — this is what makes
  // /food-hygiene-map?location=Middlesbrough a genuinely shareable link.
  useEffect(() => {
    if (initialLocationRef.current) {
      void runSearch(initialLocationRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the URL in sync with mode/filters/metric so the current view is always
  // shareable — skipped on the very first render so mounting doesn't immediately rewrite
  // a URL the visitor just arrived at (e.g. a ?location= link) before anything's changed.
  //
  // Uses the raw History API rather than next/navigation's router.replace() deliberately:
  // router.replace() re-triggers this Suspense-wrapped component's subscription to
  // useSearchParams(), which (confirmed while building this — it was silently discarding
  // flyTo state moments after a search resolved) causes React to unmount and remount the
  // whole component on every filter/search change, wiping all local state each time.
  // history.replaceState only updates the address bar; it doesn't touch React or Next's
  // router at all, which is exactly what a "make this shareable" URL sync needs here.
  useEffect(() => {
    if (skipNextUrlSyncRef.current) {
      skipNextUrlSyncRef.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (mode !== "explore") params.set("mode", mode);
    if (ratings.length > 0) params.set("ratings", ratings.join(","));
    if (categorySlugs.length > 0) params.set("types", categorySlugs.join(","));
    if (mode === "compare" && metric !== COMPARE_METRICS[0].value) params.set("metric", metric);
    if (mode === "compare" && colorblindMode) params.set("cb", "1");
    if (committedLocation.trim()) params.set("location", committedLocation.trim());

    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    window.history.replaceState(null, "", url);
  }, [mode, ratings, categorySlugs, metric, colorblindMode, committedLocation, pathname]);

  function toggleRating(value: string) {
    setRatings((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      track("map_filter_used", { type: "rating", value });
      return next;
    });
  }

  function toggleCategory(slug: string) {
    setCategorySlugs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      track("map_filter_used", { type: "category", value: slug });
      return next;
    });
  }

  function resetFilters() {
    setRatings([]);
    setCategorySlugs([]);
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    if (next === "compare") track("map_compare_opened");
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    void runSearch(searchInput);
  }

  const hasActiveFilters = ratings.length > 0 || categorySlugs.length > 0;

  const handleFlyToHandled = useCallback(() => setFlyTo(null), []);
  const handleEstablishmentClick = useCallback(
    (point: MapEstablishmentPoint) => track("map_marker_click", { fhrsId: point.fhrsId }),
    [],
  );
  const handleReportClick = useCallback(
    (point: MapEstablishmentPoint) => track("map_report_click", { fhrsId: point.fhrsId }),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="inline-flex w-fit rounded-full border border-gray-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => handleModeChange("explore")}
          aria-pressed={mode === "explore"}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            mode === "explore" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Explore establishments
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("compare")}
          aria-pressed={mode === "compare"}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            mode === "compare" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Compare areas
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex items-stretch gap-2">
        <label htmlFor="hygiene-map-search" className="sr-only">
          Search by establishment name, town, city or postcode
        </label>
        <div className="flex flex-1 items-center rounded-full border border-gray-300 bg-white pl-4 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            id="hygiene-map-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search establishment, town, city or postcode"
            autoComplete="off"
            className="w-full min-w-0 bg-transparent py-2.5 pr-3 pl-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searchLoading}
          className="shrink-0 rounded-full bg-indigo-600 px-5 text-xs font-bold tracking-wide text-white uppercase transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {searchLoading ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          aria-expanded={filtersOpen}
          aria-controls="hygiene-map-filters"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:hidden"
        >
          Filters
          {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" aria-hidden />}
        </button>
      </form>

      {searchError && <p className="text-sm text-red-700">{searchError}</p>}

      {/* Filters — always visible on sm+, a collapsible drawer below that */}
      <div id="hygiene-map-filters" className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-3 sm:flex`}>
        {mode === "explore" && (
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Rating</span>
                {RATING_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleRating(value)}
                    aria-pressed={ratings.includes(value)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      ratings.includes(value)
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">Type</span>
                {BUSINESS_CATEGORIES.map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => toggleCategory(category.slug)}
                    aria-pressed={categorySlugs.includes(category.slug)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      categorySlugs.includes(category.slug)
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              {hasActiveFilters && (
                <button type="button" onClick={resetFilters} className="text-xs font-medium text-indigo-600 hover:underline">
                  Reset filters
                </button>
              )}
            </div>

            <RatingLegend />
          </div>
        )}

        {mode === "compare" && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Show areas by</span>
            {COMPARE_METRICS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMetric(option.value)}
                aria-pressed={metric === option.value}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  metric === option.value
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}

            <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <input
                type="checkbox"
                checked={colorblindMode}
                onChange={(e) => setColorblindMode(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Colourblind-friendly colours
            </label>
          </div>
        )}
      </div>

      {/* Map */}
      {mode === "explore" ? (
        <HygieneMapExplorer
          filters={filters}
          flyTo={flyTo}
          onFlyToHandled={handleFlyToHandled}
          onEstablishmentClick={handleEstablishmentClick}
          onReportClick={handleReportClick}
        />
      ) : (
        <CompareAreasMap metric={metric} colorblindMode={colorblindMode} />
      )}
    </div>
  );
}
