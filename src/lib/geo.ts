import { Prisma } from "@/generated/prisma/client";

// Shared by both /api/establishments/nearby (paginated results list) and
// /api/establishments/nearby/map (lightweight, higher-limit map pins) — kept in one
// place so the radius cap and distance formula can't silently drift between the two.
export const EARTH_RADIUS_MILES = 3959;
export const DEFAULT_RADIUS_MILES = 1;
export const MAX_RADIUS_MILES = 10;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseRequiredCoordinate(raw: string | null, name: string, min: number, max: number): ParseResult<number> {
  if (raw === null || raw === "") {
    return { ok: false, error: `Missing required query param "${name}".` };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    return {
      ok: false,
      error: `Invalid "${name}" value: "${raw}". Must be a number between ${min} and ${max}.`,
    };
  }
  return { ok: true, value };
}

// Parses radiusMiles, defaulting when absent and silently clamping down to
// MAX_RADIUS_MILES rather than rejecting — a caller asking for "20 miles" still gets a
// useful (just smaller) result instead of an error.
export function parseRadiusMiles(raw: string | null): ParseResult<number> {
  let radiusMiles = DEFAULT_RADIUS_MILES;
  if (raw !== null && raw !== "") {
    radiusMiles = Number(raw);
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
      return { ok: false, error: `Invalid "radiusMiles" value: "${raw}". Must be a positive number.` };
    }
  }
  if (radiusMiles > MAX_RADIUS_MILES) {
    radiusMiles = MAX_RADIUS_MILES;
  }
  return { ok: true, value: radiusMiles };
}

// Cheap bounding-box pre-filter (can use the (latitude, longitude) index) before the
// precise Haversine calculation, so we're not running trig functions over the entire
// table on every request. Deliberately generous (69 miles/degree of latitude is a
// slight underestimate at UK latitudes) so it can only include extra candidate rows,
// never exclude a true match — the exact Haversine filter after it enforces the radius.
export function boundingBoxDelta(lat: number, radiusMiles: number): { latDelta: number; lngDelta: number } {
  return {
    latDelta: radiusMiles / 69,
    lngDelta: radiusMiles / (69 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01)),
  };
}

export function distanceMilesSql(lat: number, lng: number) {
  return Prisma.sql`${EARTH_RADIUS_MILES} * acos(
    LEAST(1, GREATEST(-1,
      cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng}))
      + sin(radians(${lat})) * sin(radians("latitude"))
    ))
  )`;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Parses the north/south/east/west query params shared by every viewport-driven map
 * endpoint (see /api/establishments/map-clusters) — a plain rectangle, not a
 * distance-from-point radius like the nearby/* routes above, since a Leaflet map reports
 * its visible area as `getBounds()`, not a center + radius.
 */
export function parseBoundingBox(searchParams: URLSearchParams): ParseResult<BoundingBox> {
  const north = parseRequiredCoordinate(searchParams.get("north"), "north", -90, 90);
  if (!north.ok) return north;
  const south = parseRequiredCoordinate(searchParams.get("south"), "south", -90, 90);
  if (!south.ok) return south;
  const east = parseRequiredCoordinate(searchParams.get("east"), "east", -180, 180);
  if (!east.ok) return east;
  const west = parseRequiredCoordinate(searchParams.get("west"), "west", -180, 180);
  if (!west.ok) return west;

  if (south.value > north.value) {
    return { ok: false, error: `"south" (${south.value}) must not exceed "north" (${north.value}).` };
  }
  // A UK-focused map never needs to query a viewport that wraps the antimeridian, so a
  // west > east box is simplest treated as bad input rather than as a wrapping query.
  if (west.value > east.value) {
    return { ok: false, error: `"west" (${west.value}) must not exceed "east" (${east.value}).` };
  }

  return { ok: true, value: { north: north.value, south: south.value, east: east.value, west: west.value } };
}
