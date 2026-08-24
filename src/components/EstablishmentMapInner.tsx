"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

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

interface EstablishmentMapProps {
  points: MapPoint[];
  heightClassName?: string;
}

const UK_CENTER: [number, number] = [54.5, -3];
const UK_DEFAULT_ZOOM = 5;
const SINGLE_POINT_ZOOM = 16;

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
function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], SINGLE_POINT_ZOOM);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [points, map]);

  return null;
}

export default function EstablishmentMapInner({ points, heightClassName = "h-[500px]" }: EstablishmentMapProps) {
  const router = useRouter();
  const initialCenter = useMemo<[number, number]>(
    () => (points.length > 0 ? [points[0].lat, points[0].lng] : UK_CENTER),
    [points],
  );

  return (
    <MapContainer
      center={initialCenter}
      zoom={points.length > 0 ? SINGLE_POINT_ZOOM : UK_DEFAULT_ZOOM}
      scrollWheelZoom
      className={`w-full ${heightClassName} rounded-xl border border-gray-200 shadow-sm`}
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
      <FitToPoints points={points} />
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
