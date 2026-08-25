"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

// react-leaflet's default marker icon references image paths that don't resolve
// correctly once bundled — point it at the same version's icons on a CDN instead of
// wrestling with bundler asset imports.
L.Marker.prototype.options.icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapPoint {
  id: number;
  lat: number;
  lng: number;
  label: string;
  href: string;
}

export interface SearchThisAreaQuery {
  lat: number;
  lng: number;
  radiusMiles: number;
}

interface EstablishmentMapProps {
  points: MapPoint[];
  heightClassName?: string;
  // When provided, a "Search this area" button appears once the visitor pans or zooms
  // the map themselves (as opposed to the map re-framing itself to fit new results) —
  // lets a "near me" search follow the visitor around the map instead of staying pinned
  // to wherever the original search happened.
  onSearchThisArea?: (query: SearchThisAreaQuery) => void;
}

const UK_CENTER: [number, number] = [54.5, -3];
const UK_DEFAULT_ZOOM = 5;
const SINGLE_POINT_ZOOM = 16;
const METERS_PER_MILE = 1609.344;

// Defaults to the free OpenStreetMap tile servers, which is fine for light/dev traffic
// but whose usage policy asks higher-volume sites to move to a paid provider (MapTiler,
// Stadia, Mapbox, etc.) instead. Both are overridable via env vars so switching provider
// later doesn't require a code change — see README "Deploying" section.
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Frames the map around whatever points are currently present. Runs as an effect
// (rather than just setting MapContainer's initial center/zoom) so it re-frames when
// the result set changes, e.g. after a search or a page of pagination.
//
// While it's doing so, it flips `programmaticMoveRef` on so SearchThisAreaControl can
// tell "the map moved because we re-framed it" apart from "the visitor dragged/zoomed
// it themselves" — both fire the same moveend/zoomend events, but only the latter
// should surface a "Search this area" button.
function FitToPoints({ points, programmaticMoveRef }: { points: MapPoint[]; programmaticMoveRef: RefObject<boolean> }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    programmaticMoveRef.current = true;
    // Deferred by a tick: moveend/zoomend also fire SearchThisAreaControl's own listener,
    // and Leaflet calls same-event listeners in registration order — clearing the flag
    // synchronously here would let that listener see it as already cleared and mistake
    // this programmatic re-frame for a genuine user pan/zoom. A macrotask delay lets every
    // listener for this event finish first, however they're ordered.
    const clearFlag = () => {
      setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 0);
    };

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], SINGLE_POINT_ZOOM);
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    // moveend/zoomend fire once the (possibly animated) re-frame settles; the timeout is
    // just a backstop in case the view doesn't actually change (so no event fires at all).
    map.once("moveend", clearFlag);
    map.once("zoomend", clearFlag);
    const timeout = setTimeout(clearFlag, 500);

    return () => {
      map.off("moveend", clearFlag);
      map.off("zoomend", clearFlag);
      clearTimeout(timeout);
    };
  }, [points, map, programmaticMoveRef]);

  return null;
}

// Converts a map viewport into a { lat, lng, radiusMiles } query wide enough to cover
// the whole visible area — radius is the distance from the center to the furthest
// visible corner, so nothing currently on screen falls outside the new search radius.
function boundsToRadiusMiles(center: L.LatLng, bounds: L.LatLngBounds): number {
  const corners = [bounds.getNorthEast(), bounds.getNorthWest(), bounds.getSouthEast(), bounds.getSouthWest()];
  const maxMeters = Math.max(...corners.map((corner) => center.distanceTo(corner)));
  return maxMeters / METERS_PER_MILE;
}

// Shows a floating "Search this area" button once the visitor pans or zooms the map
// themselves, Zillow/Rightmove-style — rather than auto-fetching on every map movement
// (which risks spamming the API, and fighting with FitToPoints re-framing the view once
// new results arrive), the visitor opts in to re-searching the area they've moved to.
function SearchThisAreaControl({
  programmaticMoveRef,
  onSearchThisArea,
}: {
  programmaticMoveRef: RefObject<boolean>;
  onSearchThisArea?: (query: SearchThisAreaQuery) => void;
}) {
  const [visible, setVisible] = useState(false);

  const map = useMapEvents({
    moveend() {
      if (programmaticMoveRef.current) return;
      setVisible(true);
    },
    zoomend() {
      if (programmaticMoveRef.current) return;
      setVisible(true);
    },
  });

  if (!onSearchThisArea || !visible) return null;

  function handleClick() {
    const center = map.getCenter();
    const radiusMiles = boundsToRadiusMiles(center, map.getBounds());
    onSearchThisArea?.({ lat: center.lat, lng: center.lng, radiusMiles });
    setVisible(false);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
      <button
        type="button"
        onClick={handleClick}
        className="pointer-events-auto rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-semibold text-indigo-700 shadow-md transition-colors hover:bg-indigo-50"
      >
        Search this area
      </button>
    </div>
  );
}

export default function EstablishmentMapInner({
  points,
  heightClassName = "h-[500px]",
  onSearchThisArea,
}: EstablishmentMapProps) {
  const router = useRouter();
  const programmaticMoveRef = useRef(false);
  const initialCenter = useMemo<[number, number]>(
    () => (points.length > 0 ? [points[0].lat, points[0].lng] : UK_CENTER),
    [points],
  );

  return (
    <MapContainer
      center={initialCenter}
      zoom={points.length > 0 ? SINGLE_POINT_ZOOM : UK_DEFAULT_ZOOM}
      scrollWheelZoom
      className={`relative w-full ${heightClassName} rounded-xl border border-gray-200 shadow-sm`}
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
      <FitToPoints points={points} programmaticMoveRef={programmaticMoveRef} />
      <SearchThisAreaControl programmaticMoveRef={programmaticMoveRef} onSearchThisArea={onSearchThisArea} />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          eventHandlers={{
            click: () => router.push(point.href),
          }}
        >
          <Tooltip direction="top">
            <Link href={point.href}>{point.label}</Link>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
