import L from "leaflet";
import { FHRS_SCORE_HEX, getRatingBand, RATING_BAND_HEX } from "@/lib/rating-scale";

// Short, space-efficient labels for FHIS (Scotland) statuses shown inside a marker —
// paired with a colour from RATING_BAND_HEX and the full status spelled out in both the
// marker's aria-label and the popup panel, so the abbreviation is never the only place a
// visitor (or a screen reader) can find out what it means.
const FHIS_SHORT_LABELS: Record<string, string> = {
  Pass: "P",
  "Pass and Eat Safe": "P",
  "Improvement Required": "IR",
  Exempt: "E",
  "Awaiting Inspection": "AI",
  "Awaiting Publication": "AP",
};

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

function establishmentMarkerVisual(schemeType: string, ratingValue: string): { label: string; hex: string; ariaLabel: string } {
  if (schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(ratingValue)) {
    return { label: ratingValue, hex: FHRS_SCORE_HEX[ratingValue], ariaLabel: `Food hygiene rating ${ratingValue} out of 5` };
  }
  const label = FHIS_SHORT_LABELS[ratingValue] ?? "?";
  return { label, hex: RATING_BAND_HEX[getRatingBand(schemeType, ratingValue)], ariaLabel: `Food hygiene status: ${ratingValue}` };
}

const markerIconCache = new Map<string, L.DivIcon>();

/**
 * A small coloured circle with the rating digit (or a short FHIS status code) inside —
 * built as a plain Leaflet divIcon (raw HTML string) rather than a React component,
 * since react-leaflet markers render outside the normal React tree. Colour alone never
 * carries the meaning: every icon also shows a label and carries an aria-label, and the
 * full rating is repeated in the marker's popup.
 */
export function getEstablishmentMarkerIcon(schemeType: string, ratingValue: string): L.DivIcon {
  const key = `${schemeType}:${ratingValue}`;
  const cached = markerIconCache.get(key);
  if (cached) return cached;

  const { label, hex, ariaLabel } = establishmentMarkerVisual(schemeType, ratingValue);
  const icon = L.divIcon({
    className: "",
    html: `<div role="img" aria-label="${ariaLabel}" style="width:26px;height:26px;border-radius:9999px;background:${hex};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px;font-family:ui-sans-serif,system-ui,sans-serif;">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
  markerIconCache.set(key, icon);
  return icon;
}

// Three broad size tiers rather than a continuous scale — keeps clusters visually
// consistent instead of computing a bespoke pixel size for every distinct count that
// comes back from the server.
function clusterSizeTier(count: number): 1 | 2 | 3 {
  if (count < 100) return 1;
  if (count < 5000) return 2;
  return 3;
}

const CLUSTER_TIER_PX: Record<1 | 2 | 3, number> = { 1: 38, 2: 46, 3: 54 };
const CLUSTER_TIER_FONT_PX: Record<1 | 2 | 3, number> = { 1: 12, 2: 12, 3: 11 };
const clusterIconCache = new Map<number, L.DivIcon>();

/**
 * A numbered indigo bubble for a grid cluster cell — brand-coloured rather than
 * rating-coloured, since a single cluster mixes establishments of every rating. The count
 * is comma-formatted (e.g. "12,482") to stay readable at a glance. Cached per exact count
 * (bounded in practice — a single map view only ever shows a few dozen distinct cluster
 * sizes at once) so panning/zooming doesn't rebuild identical icons repeatedly.
 */
export function buildClusterIcon(count: number): L.DivIcon {
  const cached = clusterIconCache.get(count);
  if (cached) return cached;

  const tier = clusterSizeTier(count);
  const px = CLUSTER_TIER_PX[tier];
  const fontPx = CLUSTER_TIER_FONT_PX[tier];
  const icon = L.divIcon({
    className: "",
    html: `<div role="img" aria-label="${count.toLocaleString("en-GB")} establishments in this area" style="width:${px}px;height:${px}px;border-radius:9999px;background:#4f46e5;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${fontPx}px;font-family:ui-sans-serif,system-ui,sans-serif;text-align:center;line-height:1;">${count.toLocaleString("en-GB")}</div>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
  });
  clusterIconCache.set(count, icon);
  return icon;
}
