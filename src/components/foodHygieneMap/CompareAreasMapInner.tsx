"use client";

import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, Path, PathOptions } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { AreaHygieneStats } from "@/lib/area-queries";
import { buildColorScale, getCompareMetric, getScaleColor, getScaleGradientCss } from "@/lib/compare-metrics";

interface CompareAreasMapInnerProps {
  metric: string;
  heightClassName: string;
  colorblindMode: boolean;
}

interface BoundaryProperties {
  localAuthorityName: string;
  country: "England" | "Wales" | "Scotland" | "Northern Ireland" | "Unknown";
}

const UK_CENTER: [number, number] = [54.5, -3];
const UK_DEFAULT_ZOOM = 6;
const NO_DATA_FILL = "#d1d5db"; // gray-300 — areas with no qualifying stats

const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function buildPopupHtml(name: string, area: AreaHygieneStats | undefined, country: string): string {
  const safeName = escapeHtml(name);
  if (!area) {
    const reason =
      country === "Scotland"
        ? "Scotland uses a separate scheme (FHIS Pass/Improvement Required), not the 0-5 FHRS scale this comparison is based on."
        : "Not enough numerically rated establishments yet to include in this comparison.";
    return `<div style="min-width:200px;max-width:240px;font-family:ui-sans-serif,system-ui,sans-serif;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#111827;">${safeName}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">${reason}</p>
    </div>`;
  }

  const row = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;"><span>${label}</span><span style="font-weight:600;color:#111827;">${value}</span></div>`;

  const viewLink = area.slug
    ? `<a href="/area/${area.slug}" style="margin-top:10px;display:flex;align-items:center;justify-content:center;width:100%;border-radius:6px;background:#4f46e5;padding:6px 12px;font-size:12px;font-weight:600;color:#fff;text-decoration:none;">View ${safeName}</a>`
    : "";

  return `<div style="min-width:220px;max-width:260px;font-family:ui-sans-serif,system-ui,sans-serif;">
    <p style="margin:0;font-size:13px;font-weight:600;color:#111827;">${safeName}</p>
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#4b5563;">
      ${row("Rated establishments", area.ratedCount.toLocaleString("en-GB"))}
      ${row("Average rating", area.averageRating.toFixed(2))}
      ${row("Rated 5", `${area.pctRated5}%`)}
      ${row("Rated 4 or 5", `${area.pctRated4Or5}%`)}
      ${row("Rated 0-2", `${area.pctRated0To2}%`)}
    </div>
    ${viewLink}
  </div>`;
}

export default function CompareAreasMapInner({ metric, heightClassName, colorblindMode }: CompareAreasMapInnerProps) {
  const [stats, setStats] = useState<AreaHygieneStats[] | null>(null);
  const [boundaries, setBoundaries] = useState<FeatureCollection<Geometry, BoundaryProperties> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/local-authorities/hygiene-stats", { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("Failed to load area comparison data.");
        return res.json() as Promise<{ data: AreaHygieneStats[] }>;
      }),
      fetch("/boundaries/uk-local-authorities.geojson", { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("Failed to load area boundaries.");
        return res.json() as Promise<FeatureCollection<Geometry, BoundaryProperties>>;
      }),
    ])
      .then(([statsBody, boundariesBody]) => {
        setStats(statsBody.data);
        setBoundaries(boundariesBody);
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
  const statsByName = useMemo(() => {
    const map = new Map<string, AreaHygieneStats>();
    stats?.forEach((area) => map.set(area.localAuthorityName, area));
    return map;
  }, [stats]);
  const colorScale = useMemo(
    () => (stats ? buildColorScale(stats, metricOption, colorblindMode) : () => NO_DATA_FILL),
    [stats, metricOption, colorblindMode],
  );

  function styleFeature(feature?: Feature<Geometry, BoundaryProperties>): PathOptions {
    const area = feature ? statsByName.get(feature.properties.localAuthorityName) : undefined;
    return {
      fillColor: area ? colorScale(area) : NO_DATA_FILL,
      fillOpacity: area ? 0.75 : 0.35,
      color: "#ffffff",
      weight: 1,
    };
  }

  function onEachFeature(feature: Feature<Geometry, BoundaryProperties>, layer: Layer) {
    const { localAuthorityName, country } = feature.properties;
    const area = statsByName.get(localAuthorityName);
    layer.bindPopup(buildPopupHtml(localAuthorityName, area, country));
    layer.on({
      mouseover: (e) => (e.target as Path).setStyle({ weight: 2, fillOpacity: (area ? 0.75 : 0.35) + 0.15 }),
      mouseout: (e) => (e.target as Path).setStyle(styleFeature(feature)),
    });
  }

  return (
    <div className={`relative w-full ${heightClassName}`}>
      <MapContainer
        center={UK_CENTER}
        zoom={UK_DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-xl border border-gray-200 shadow-sm"
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />

        {/* Keyed by metric + colour mode: Leaflet's GeoJSON layer computes each feature's
            style once, imperatively, when it's added — it doesn't re-run `style` on a prop
            change, so switching metrics or toggling colourblind mode needs a fresh layer
            (react-leaflet's own recommended pattern for this) rather than relying on it to
            reactively restyle in place. */}
        {boundaries && (
          <GeoJSON key={`${metric}:${colorblindMode}`} data={boundaries} style={styleFeature} onEachFeature={onEachFeature} />
        )}
      </MapContainer>

      {!loading && !error && (
        <div className="absolute right-3 bottom-3 z-[1000] flex flex-col gap-1 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-600 shadow-md">
          <span className="font-medium text-gray-700">{metricOption.label}</span>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: getScaleColor(0, colorblindMode) }} aria-hidden />
            Lower
            <span
              className="mx-1 h-3 w-8 rounded-sm"
              style={{ background: getScaleGradientCss(colorblindMode) }}
              aria-hidden
            />
            Higher
            <span className="h-3 w-3 rounded-sm" style={{ background: getScaleColor(1, colorblindMode) }} aria-hidden />
          </div>
          <div className="mt-1 flex items-center gap-1.5 border-t border-gray-100 pt-1">
            <span className="h-3 w-3 rounded-sm" style={{ background: NO_DATA_FILL }} aria-hidden />
            No comparable data
          </div>
        </div>
      )}

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
