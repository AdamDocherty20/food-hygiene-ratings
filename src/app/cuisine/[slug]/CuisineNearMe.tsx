"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, searchEstablishments, searchNearby } from "@/lib/api-client";
import { EstablishmentMap, type MapPoint } from "@/components/EstablishmentMap";
import { RatingBadge } from "@/components/RatingBadge";
import { formatAddress } from "@/lib/format";
import { establishmentPath } from "@/lib/slug";
import type { Establishment, EstablishmentWithDistance } from "@/lib/types";

const RADIUS_OPTIONS_MILES = [1, 2, 5, 10];
const DEFAULT_RADIUS_MILES = 2;

type LocationState =
  | { status: "locating" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied" }
  | { status: "unsupported" };

type ResultsState =
  | { status: "loading" }
  | { status: "success"; data: (Establishment & { distanceMiles?: number })[] }
  | { status: "error"; message: string };

function toMapPoints(results: (Establishment & { distanceMiles?: number })[]): MapPoint[] {
  return results
    .filter((r): r is Establishment & { latitude: number; longitude: number } => r.latitude !== null && r.longitude !== null)
    .map((r) => ({ id: r.id, lat: r.latitude, lng: r.longitude, label: r.businessName, href: establishmentPath(r.fhrsId, r.businessName) }));
}

// Requests the visitor's location as soon as this page loads (not gated behind another
// click — the whole point of a dedicated "near you" page is that it just works), falling
// back to a nationwide top-rated list for the cuisine if location is denied/unsupported
// rather than showing a dead end.
export function CuisineNearMe({ slug, label }: { slug: string; label: string }) {
  // Always starts as "locating" on both server and client — checking `"geolocation" in
  // navigator` during the lazy initializer would run on the server too, where `navigator`
  // doesn't exist, producing a *different* initial state there than on the client and
  // breaking hydration (confirmed via a real `next build`/`next start` test, not just dev
  // mode). The effect below is the only place that can safely tell, since it only runs
  // client-side after hydration.
  const [location, setLocation] = useState<LocationState>({ status: "locating" });
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // Synchronous setState here is intentional, not an anti-pattern to avoid: support
      // can only be known client-side, so this is what transitions away from the shared
      // initial state once we actually find out — same role as the async
      // getCurrentPosition callbacks below, just for the "can't even ask" case.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocation({ status: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ status: "granted", lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setLocation({ status: "denied" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Same "derive during render" key-comparison pattern SearchPageContent.tsx uses for its
  // own request state — the effect below only ever calls setState from within its
  // .then/.catch callbacks, never synchronously in the effect body.
  const requestKey =
    location.status === "granted"
      ? `nearby|${location.lat.toFixed(5)}|${location.lng.toFixed(5)}|${radiusMiles}|${slug}`
      : location.status === "denied" || location.status === "unsupported"
        ? `nationwide|${slug}`
        : null;

  const [results, setResults] = useState<{ key: string | null; state: ResultsState }>({ key: requestKey, state: { status: "loading" } });
  if (results.key !== requestKey) {
    setResults({ key: requestKey, state: { status: "loading" } });
  }

  useEffect(() => {
    if (!requestKey) return;

    let cancelled = false;
    const request =
      location.status === "granted"
        ? searchNearby(
            new URLSearchParams({ lat: location.lat.toFixed(5), lng: location.lng.toFixed(5), radiusMiles: String(radiusMiles), cuisine: slug }),
          )
        : searchEstablishments(new URLSearchParams({ cuisine: slug, sort: "rating_desc", pageSize: "20" }));

    request
      .then((response) => {
        if (!cancelled) setResults({ key: requestKey, state: { status: "success", data: response.data } });
      })
      .catch((err) => {
        if (!cancelled) {
          setResults({
            key: requestKey,
            state: { status: "error", message: err instanceof ApiError ? err.message : "Something went wrong. Please try again." },
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // location.lat/lng/status and radiusMiles are all already captured in requestKey — re-running
    // this effect on requestKey change is sufficient and avoids re-fetching on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const isNationwideFallback = location.status === "denied" || location.status === "unsupported";
  const mapPoints = results.state.status === "success" ? toMapPoints(results.state.data) : [];

  return (
    <div>
      {location.status === "locating" && <p className="mb-4 text-sm text-gray-500">Finding your location…</p>}

      {isNationwideFallback && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {location.status === "denied" ? "Location access wasn't granted" : "Your browser doesn't support location"} — showing
          top-rated {label.toLowerCase()} places nationwide instead.
        </div>
      )}

      {location.status === "granted" && (
        <label className="mb-4 flex items-center gap-1.5 text-sm text-gray-600">
          Within
          <select
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
          >
            {RADIUS_OPTIONS_MILES.map((mi) => (
              <option key={mi} value={mi}>
                {mi} mi
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          {results.state.status === "loading" && <p className="text-sm text-gray-500">Loading…</p>}
          {results.state.status === "error" && <p className="text-sm text-red-600">{results.state.message}</p>}
          {results.state.status === "success" && results.state.data.length === 0 && (
            <p className="text-sm text-gray-500">
              No {label.toLowerCase()} places found{location.status === "granted" ? " nearby — try a wider radius." : "."}
            </p>
          )}
          {results.state.status === "success" && results.state.data.length > 0 && (
            <ul className="flex flex-col gap-3">
              {results.state.data.map((result) => (
                <li key={result.id}>
                  <Link
                    href={establishmentPath(result.fhrsId, result.businessName)}
                    className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{result.businessName}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{result.businessType}</p>
                      <p className="mt-1 text-sm text-gray-600">{formatAddress(result)}</p>
                      {"distanceMiles" in result && typeof (result as EstablishmentWithDistance).distanceMiles === "number" && (
                        <p className="mt-1 text-xs font-medium text-indigo-600">
                          {(result as EstablishmentWithDistance).distanceMiles.toFixed(1)} mi away
                        </p>
                      )}
                    </div>
                    <RatingBadge schemeType={result.schemeType} ratingValue={result.ratingValue} ratingDate={result.ratingDate} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {location.status === "granted" && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <EstablishmentMap points={mapPoints} />
          </div>
        )}
      </div>
    </div>
  );
}
