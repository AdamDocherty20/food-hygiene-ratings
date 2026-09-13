"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LOCAL_AUTHORITIES } from "@/lib/local-authorities";

const MAX_SUGGESTIONS = 6;
// Shown when the location field is focused but empty — the biggest areas by establishment
// count, same "most likely to be relevant" heuristic as the homepage's Popular Areas grid.
const DEFAULT_AREAS = [...LOCAL_AUTHORITIES].sort((a, b) => b.count - a.count).slice(0, MAX_SUGGESTIONS);

// A bigger, two-field header search (location + business name) with a "near me" /
// area-suggestions dropdown on the location field, replacing the original single-keyword
// input — the homepage's own hero form (name/postcode/business type, see
// SearchPageContent.tsx) is still the "full" search; this is the persistent nav version,
// just closer in weight to it now than the original compact single-field version was.
export function HeaderSearch() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [name, setName] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = location.trim()
    ? LOCAL_AUTHORITIES.filter((area) => area.name.toLowerCase().includes(location.trim().toLowerCase())).slice(0, MAX_SUGGESTIONS)
    : DEFAULT_AREAS;

  function navigate(extra: URLSearchParams) {
    const trimmedName = name.trim();
    if (trimmedName) extra.set("name", trimmedName);
    extra.set("page", "1");
    router.push(`/?${extra.toString()}`);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSuggestionsOpen(false);
    const trimmedLocation = location.trim();
    // Free text that wasn't picked from the suggestion list — not guaranteed to match a
    // real area, same graceful "just might return zero results" behaviour the homepage
    // hero's own postcode field already has for an unrecognised value.
    navigate(new URLSearchParams(trimmedLocation ? { postcode: trimmedLocation } : {}));
  }

  function handleAreaSelect(areaName: string) {
    setLocation(areaName);
    setSuggestionsOpen(false);
    navigate(new URLSearchParams({ localAuthorityName: areaName }));
  }

  function handleNearMe() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setSuggestionsOpen(false);
        navigate(
          new URLSearchParams({
            lat: position.coords.latitude.toFixed(5),
            lng: position.coords.longitude.toFixed(5),
            radiusMiles: "2",
          }),
        );
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  }

  // A plain onBlur would close the dropdown before a click on one of its own options
  // registers — deferring the close lets that click's own handler fire first, then the
  // timer closes it if focus didn't move somewhere else in the dropdown.
  function handleBlur() {
    blurTimer.current = setTimeout(() => setSuggestionsOpen(false), 150);
  }
  function cancelBlur() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  return (
    <form onSubmit={handleSubmit} className="relative hidden w-full max-w-2xl sm:block">
      <div className="flex items-stretch overflow-visible rounded-full border border-gray-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
        <div className="relative flex flex-1 items-center pl-4">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c-4.5-4.2-7-7.9-7-11a7 7 0 1114 0c0 3.1-2.5 6.8-7 11z" />
            <circle cx="12" cy="10" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <label htmlFor="header-search-location" className="sr-only">
            Location
          </label>
          <input
            id="header-search-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={handleBlur}
            placeholder="Location"
            autoComplete="off"
            className="w-full min-w-0 rounded-full bg-transparent py-2.5 pr-3 pl-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />

          {suggestionsOpen && (
            <div
              onMouseDown={cancelBlur}
              className="absolute top-full left-0 z-30 mt-2 w-80 rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
            >
              <button
                type="button"
                onClick={handleNearMe}
                disabled={locating}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
                {locating ? "Finding you…" : "Near me"}
              </button>

              {suggestions.length > 0 && (
                <>
                  <p className="mt-1 px-4 pt-1 pb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                    {location.trim() ? "Suggestions" : "Popular areas"}
                  </p>
                  {suggestions.map((area) => (
                    <button
                      key={area.slug}
                      type="button"
                      onClick={() => handleAreaSelect(area.name)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c-4.5-4.2-7-7.9-7-11a7 7 0 1114 0c0 3.1-2.5 6.8-7 11z" />
                        <circle cx="12" cy="10" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {area.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-px shrink-0 self-stretch bg-gray-200" aria-hidden />

        <div className="flex flex-1 items-center pl-4">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <label htmlFor="header-search-name" className="sr-only">
            Restaurant or business name
          </label>
          <input
            id="header-search-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Restaurant, business name..."
            className="w-full min-w-0 rounded-full bg-transparent py-2.5 pr-3 pl-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="m-1 shrink-0 rounded-full bg-indigo-600 px-5 text-xs font-bold tracking-wide text-white uppercase transition-colors hover:bg-indigo-700"
        >
          Search
        </button>
      </div>
    </form>
  );
}

// Mobile equivalent of HeaderSearch above — there's no room for the full two-field bar at
// narrow widths, so this is just an icon button that jumps straight to the homepage hero's
// full search form instead of squeezing a second, cramped input into the header.
export function HeaderSearchButton() {
  return (
    <Link
      href="/"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-indigo-600 sm:hidden"
      aria-label="Search"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
      </svg>
    </Link>
  );
}
