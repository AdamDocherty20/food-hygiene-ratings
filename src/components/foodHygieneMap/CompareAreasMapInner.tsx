"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { AreaHygieneStats } from "@/lib/area-queries";
import { buildColorScale, getCompareMetric } from "@/lib/compare-metrics";

interface CompareAreasMapInnerProps {
  metric: string;
  heightClassName: string;
}

const UK_CENTER: [number, number] = [54.5, -3];
const UK_DEFAULT_ZOOM = 6;

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const areaIconCache = new Map<string, L.DivIcon>();

function buildAreaIcon(label: string, color: string): L.DivIcon {
  const key = `${label}:${color}`;
  const cached = areaIconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: "",
    html: `<div style="min-width:40px;height:28px;padding:0 6px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px;font-family:ui-sans-serif,system-ui,sans-serif;white-space:nowrap;">${label}</div>`,
    iconSize: [44, 28],
    iconAnchor: [22, 14],
    popupAnchor: [0, -14],
  });
  areaIconCache.set(key, icon);
  return icon;
}

export default function CompareAreasMapInner({ metric, heightClassName }: CompareAreasMapInnerProps) {
  const [stats, setStats] = useState<AreaHygieneStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No initial setLoading(true)/setError(null) here — loading/error already start at
    // true/null, and this effect only ever runs once (this component only takes a
    // `metric` prop, which doesn't affect what data to fetch), so there's nothing to reset.
    const controller = new AbortController();
    fetch("/api/local-authorities/hygiene-stats", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load area comparison data.");
        const body = (await res.json()) as { data: AreaHygieneStats[] };
        return body.data;
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load area comparison data.");
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const metricOption = getCompareMetric(metric);
  const colorScale = useMemo(() => (stats ? buildColorScale(stats, metricOption) : () => "#6b7280"), [stats, metricOption]);

  return (
    <div className={`relative w-full ${heightClassName}`}>
      <MapContainer
        center={UK_CENTER}
        zoom={UK_DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-xl border border-gray-200 shadow-sm"
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />

        {stats?.map((area) => (
          <Marker
            key={area.localAuthorityName}
            position={[area.lat, area.lng]}
            icon={buildAreaIcon(metricOption.format(area), colorScale(area))}
          >
            <Popup>
              <div className="min-w-[220px] max-w-[260px]">
                <p className="text-sm font-semibold text-gray-900">{area.localAuthorityName}</p>
                <dl className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
                  <div className="flex justify-between gap-3">
                    <dt>Rated establishments</dt>
                    <dd className="font-medium text-gray-900">{area.ratedCount.toLocaleString("en-GB")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Average rating</dt>
                    <dd className="font-medium text-gray-900">{area.averageRating.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Rated 5</dt>
                    <dd className="font-medium text-gray-900">{area.pctRated5}%</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Rated 4 or 5</dt>
                    <dd className="font-medium text-gray-900">{area.pctRated4Or5}%</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Rated 0-2</dt>
                    <dd className="font-medium text-gray-900">{area.pctRated0To2}%</dd>
                  </div>
                </dl>
                {area.slug && (
                  <Link
                    href={`/area/${area.slug}`}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                  >
                    View {area.localAuthorityName}
                  </Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {loading && (
        <div
          role="status"
          className="pointer-events-none absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-md"
        >
          Loading area comparison…
        </div>
      )}

      {error && (
        <div className="absolute inset-x-3 top-3 z-[1000] rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 shadow-md">
          {error}
        </div>
      )}
    </div>
  );
}
