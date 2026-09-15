"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { RatingBadge } from "@/components/RatingBadge";
import { formatAddress } from "@/lib/format";
import type { MapClustersResponse, MapEstablishmentPoint } from "@/lib/map-types";
import { establishmentPath } from "@/lib/slug";
import { buildClusterIcon, getEstablishmentMarkerIcon } from "./mapIcons";

export interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
  /** When set, opens this establishment's popup once its marker is loaded at the new location. */
  openPopupForId?: number;
}

export interface HygieneMapFilters {
  ratings: string[];
  businessTypeIds: number[];
}

interface HygieneMapExplorerInnerProps {
  filters: HygieneMapFilters;
  flyTo: FlyToTarget | null;
  onFlyToHandled: () => void;
  onEstablishmentClick?: (point: MapEstablishmentPoint) => void;
  onReportClick?: (point: MapEstablishmentPoint) => void;
  heightClassName: string;
}

const UK_CENTER: [number, number] = [54.5, -3];
const UK_DEFAULT_ZOOM = 6;
const CLUSTER_ZOOM_STEP = 2;
// Panning/zooming fires moveend continuously while a visitor drags — this debounce keeps
// map-clusters requests to roughly one per pause rather than one per intermediate frame,
// both for the API's per-IP rate limit (60/min, see src/lib/rate-limit.ts) and to avoid
// wasted queries the visitor never sees the result of anyway.
const DEBOUNCE_MS = 450;

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function buildClusterParams(bounds: L.LatLngBounds, filters: HygieneMapFilters): URLSearchParams {
  const params = new URLSearchParams({
    north: bounds.getNorth().toFixed(5),
    south: bounds.getSouth().toFixed(5),
    east: bounds.getEast().toFixed(5),
    west: bounds.getWest().toFixed(5),
  });
  if (filters.ratings.length > 0) params.set("ratings", filters.ratings.join(","));
  if (filters.businessTypeIds.length > 0) params.set("businessTypeIds", filters.businessTypeIds.join(","));
  return params;
}

// Owns the actual data fetching: once on mount/filter change, then again on every
// (debounced) moveend. Lives inside MapContainer so it can read the live viewport via
// useMap()/useMapEvents() rather than the parent having to track Leaflet's internal state.
function DataLoader({
  filters,
  onData,
  onLoadingChange,
  onError,
}: {
  filters: HygieneMapFilters;
  onData: (data: MapClustersResponse) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: string | null) => void;
}) {
  const map = useMap();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    onLoadingChange(true);
    onError(null);

    // Defensive: confirmed while building this that map.getBounds() can briefly report a
    // degenerate (zero-width) box right after a programmatic setView — moveend fires
    // before Leaflet's internal pixel-origin cache has fully caught up with the new
    // zoom/center. invalidateSize() is cheap and idempotent when the size hasn't actually
    // changed, so calling it unconditionally here is a simple way to guarantee
    // getBounds() reflects the map's real current view every time this runs.
    map.invalidateSize();
    const params = buildClusterParams(map.getBounds(), filters);
    fetch(`/api/establishments/map-clusters?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load map data.");
        }
        return res.json() as Promise<MapClustersResponse>;
      })
      .then((data) => {
        onData(data);
        onLoadingChange(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        onError(err instanceof Error ? err.message : "Failed to load map data.");
        onLoadingChange(false);
      });
  }, [map, filters, onData, onLoadingChange, onError]);

  // Re-fetches whenever the filters (or the fetchData closure they're baked into) change —
  // covers both the very first load and every subsequent filter change in one effect.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useMapEvents({
    moveend() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchData, DEBOUNCE_MS);
    },
  });

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  return null;
}

// Leaflet measures its container once at mount and doesn't notice later resizes on its
// own — same issue (and fix) as EstablishmentMapInner.tsx's own InvalidateSizeOnVisible.
// On this page it bit even the plain initial mount: a MapContainer inside a flex layout
// can be measured before the surrounding page has finished laying out, so `getBounds()`
// briefly returns a degenerate (zero-width) box — which is exactly what produced silent
// no-op map-clusters requests during testing (a north/south/east/west box with
// east === west matches nothing). Re-measuring after mount, and again on any later resize
// (e.g. the mobile filters drawer opening/closing changes the map's available height),
// keeps the map's idea of its own size correct.
function InvalidateSizeOnResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    // Fixes the zero-size-at-mount race directly.
    map.invalidateSize();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

// Reacts to the parent handing over a new `flyTo` target (from a search result or a
// shareable ?location= URL) by panning/zooming the live Leaflet map there — the search
// box itself has no direct handle on the map instance, so this is the bridge between them.
function FlyToHandler({
  flyTo,
  onHandled,
  onPendingPopup,
}: {
  flyTo: FlyToTarget | null;
  onHandled: () => void;
  onPendingPopup: (id: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!flyTo) return;
    // setView rather than flyTo: flyTo's smooth pan/zoom is driven by
    // requestAnimationFrame, and on a backgrounded/throttled tab that can leave the
    // animation permanently stuck mid-flight (confirmed while building this — the map
    // instance itself was fine, but a flyTo call would visibly do nothing at all,
    // while an immediate setView to the same coordinates worked every time). A search
    // result jumping straight to its target is a perfectly reasonable interaction on
    // its own, and it's not dependent on the tab having an active rendering loop.
    map.setView([flyTo.lat, flyTo.lng], flyTo.zoom);
    if (flyTo.openPopupForId !== undefined) onPendingPopup(flyTo.openPopupForId);
    onHandled();
  }, [flyTo, map, onHandled, onPendingPopup]);

  return null;
}

function EstablishmentPopupContent({
  point,
  onReportClick,
}: {
  point: MapEstablishmentPoint;
  onReportClick?: (point: MapEstablishmentPoint) => void;
}) {
  const href = establishmentPath(point.fhrsId, point.businessName);
  return (
    <div className="min-w-[220px] max-w-[260px]">
      <p className="text-sm font-semibold text-gray-900">{point.businessName}</p>
      <p className="mt-0.5 text-xs text-gray-500">{point.businessType}</p>
      <div className="mt-2">
        <RatingBadge schemeType={point.schemeType} ratingValue={point.ratingValue} ratingDate={point.ratingDate} />
      </div>
      <p className="mt-2 text-xs text-gray-600">{formatAddress(point)}</p>
      <p className="mt-1 text-xs text-gray-400">{point.localAuthorityName}</p>
      <Link
        href={href}
        onClick={() => onReportClick?.(point)}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        View full hygiene report
      </Link>
    </div>
  );
}

export default function HygieneMapExplorerInner({
  filters,
  flyTo,
  onFlyToHandled,
  onEstablishmentClick,
  onReportClick,
  heightClassName,
}: HygieneMapExplorerInnerProps) {
  const [data, setData] = useState<MapClustersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());
  const pendingPopupIdRef = useRef<number | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const handleData = useCallback((next: MapClustersResponse) => {
    setData(next);
  }, []);

  // Once the data a pending "open this establishment's popup" request depends on has
  // arrived, open it — the fetch triggered by FlyToHandler's own flyTo (via moveend) is
  // asynchronous, so this can't happen synchronously inside FlyToHandler itself.
  useEffect(() => {
    const pendingId = pendingPopupIdRef.current;
    if (pendingId === null || !data) return;
    const marker = markerRefs.current.get(pendingId);
    if (marker) {
      marker.openPopup();
      pendingPopupIdRef.current = null;
    }
  }, [data]);

  function handleClusterClick(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    // setView, not flyTo — see FlyToHandler's comment on why.
    map.setView([lat, lng], Math.min(map.getZoom() + CLUSTER_ZOOM_STEP, 18));
  }

  return (
    <div className={`relative w-full ${heightClassName}`}>
      <MapContainer
        center={UK_CENTER}
        zoom={UK_DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-xl border border-gray-200 shadow-sm"
        ref={mapRef}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
        <InvalidateSizeOnResize />
        <DataLoader filters={filters} onData={handleData} onLoadingChange={setLoading} onError={setError} />
        <FlyToHandler
          flyTo={flyTo}
          onHandled={onFlyToHandled}
          onPendingPopup={(id) => {
            pendingPopupIdRef.current = id;
          }}
        />

        {data?.mode === "clusters" &&
          data.clusters.map((cluster) => (
            <Marker
              key={`${cluster.lat.toFixed(4)}-${cluster.lng.toFixed(4)}-${cluster.count}`}
              position={[cluster.lat, cluster.lng]}
              icon={buildClusterIcon(cluster.count)}
              eventHandlers={{ click: () => handleClusterClick(cluster.lat, cluster.lng) }}
              keyboard
            />
          ))}

        {data?.mode === "points" &&
          data.points.map((point) => (
            <Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={getEstablishmentMarkerIcon(point.schemeType, point.ratingValue)}
              ref={(marker) => {
                if (marker) markerRefs.current.set(point.id, marker);
                else markerRefs.current.delete(point.id);
              }}
              eventHandlers={{ click: () => onEstablishmentClick?.(point) }}
            >
              <Popup>
                <EstablishmentPopupContent point={point} onReportClick={onReportClick} />
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {loading && (
        <div
          role="status"
          className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-md"
        >
          Loading establishments…
        </div>
      )}

      {error && (
        <div className="absolute inset-x-3 top-3 z-[1000] rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 shadow-md">
          {error}
        </div>
      )}

      {!loading && !error && data && data.totalCount === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
          <p className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-600 shadow-md">
            No establishments match your filters in this area.
          </p>
        </div>
      )}
    </div>
  );
}
