"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { searchNearby } from "@/lib/api-client";
import { RatingBadge } from "@/components/RatingBadge";
import { formatAddress } from "@/lib/format";
import { establishmentPath } from "@/lib/slug";
import type { EstablishmentWithDistance } from "@/lib/types";

interface NearbyEstablishmentsProps {
  fhrsId: number;
  lat: number;
  lng: number;
}

const RADIUS_MILES = "1";
// Fetches a few extra results since the establishment itself will usually be the
// closest match within its own radius search and gets filtered out below.
const FETCH_COUNT = 7;
const DISPLAY_COUNT = 6;

type State =
  | { key: string; status: "loading" }
  | { key: string; status: "ready"; items: EstablishmentWithDistance[] }
  | { key: string; status: "error" };

// A horizontally-scrolling strip of other establishments within a mile, shown under the
// map on the establishment detail page — reuses the same /api/establishments/nearby
// endpoint that powers the homepage's "Search near me" feature.
export function NearbyEstablishments({ fhrsId, lat, lng }: NearbyEstablishmentsProps) {
  const key = `${fhrsId}:${lat}:${lng}`;

  // Same "derive during render" pattern used elsewhere in this app: flip to "loading"
  // for the new key synchronously during render, and only ever call setState from
  // within the effect's async callbacks (never synchronously in the effect body).
  const [state, setState] = useState<State>({ key, status: "loading" });
  if (state.key !== key) {
    setState({ key, status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusMiles: RADIUS_MILES,
      pageSize: String(FETCH_COUNT),
    });

    searchNearby(params)
      .then((response) => {
        if (cancelled) return;
        setState({
          key,
          status: "ready",
          items: response.data.filter((item) => item.fhrsId !== fhrsId).slice(0, DISPLAY_COUNT),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ key, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [key, fhrsId, lat, lng]);

  // Fails and empty-results are both silent — this is a "nice to have" strip, not core
  // content, so it just doesn't render rather than showing an error or "no results" state.
  if (state.status === "error" || (state.status === "ready" && state.items.length === 0)) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-gray-900">Other places nearby</h2>
      {state.status === "loading" ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 w-56 shrink-0 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {state.items.map((item) => (
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
      )}
    </div>
  );
}
