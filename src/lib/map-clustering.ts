import type { BoundingBox } from "@/lib/geo";

// Below this many matching establishments in the current viewport, /api/establishments/map-clusters
// returns individual points instead of grid clusters — low enough that a client-side
// Leaflet marker per point is still cheap to render, high enough that a moderately busy
// town center doesn't flicker between the two modes while panning. Easy to retune.
export const INDIVIDUAL_MARKER_THRESHOLD = 200;

// Server-side "how many establishments came back" queries return early once they've
// counted this many — the exact number stops mattering once it's well past
// INDIVIDUAL_MARKER_THRESHOLD, so there's no reason to make Postgres count all 600k+ rows
// for a country-wide view.
export const COUNT_CAP = 5000;

// The grid used for clustering is sized relative to the current viewport rather than a
// fixed zoom→size lookup table: dividing whatever's on screen into roughly this many
// cells across its longer axis means clusters are always "country-sized" at a UK-wide
// view and "neighbourhood-sized" once zoomed into a town, with no dependency on the
// client accurately reporting its Leaflet zoom level — only the bounding box matters.
// It also self-limits the number of clusters returned to roughly this value squared.
const TARGET_GRID_CELLS_ACROSS = 12;

// Prevents the cell size collapsing to ~0 for a very small bounding box (e.g. already
// zoomed to street level with an empty result) — a sub-100m cell wouldn't visually
// cluster anything anyway, since by then the establishment count is almost always under
// INDIVIDUAL_MARKER_THRESHOLD and points mode takes over instead.
const MIN_CELL_SIZE_DEGREES = 0.001;

export function computeCellSizeDegrees(bbox: BoundingBox): number {
  const latSpan = Math.max(bbox.north - bbox.south, 0);
  const lngSpan = Math.max(bbox.east - bbox.west, 0);
  const span = Math.max(latSpan, lngSpan);
  return Math.max(span / TARGET_GRID_CELLS_ACROSS, MIN_CELL_SIZE_DEGREES);
}
