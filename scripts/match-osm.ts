// Matches active FSA establishments against OpenStreetMap points — see the "OpenStreetMap"
// section of the data-layer brief this implements.
//
// The brief's suggested tooling (osmium-tool / pyosmium against a downloaded Geofabrik
// .osm.pbf, Overpass only for spot re-checks) turned out to be exactly right: a live
// Overpass query scoped to our tags for all of Great Britain proved unreliable even for a
// single tag (the public instance returned "server too busy" or timed out repeatedly) — see
// this commit's message for the investigation. So the actual pipeline here is:
//
//   1. Download the GB extract from Geofabrik (~2GB) — done manually, see README notes.
//   2. `osmium tags-filter` down to just our target tags (~23MB, seconds to run).
//   3. `osmium export` to GeoJSON (points only) for this script to parse.
//
// Two match methods, deliberately in priority order:
//   - Exact: many OSM points already carry the FSA's own fhrs:id tag (mappers
//     cross-reference it directly) — ~49% of tagged points in testing. No ambiguity, no
//     threshold to tune.
//   - Spatial: the brief's original approach for everything else — nearest named point
//     within 75m, disambiguated by name similarity, scoped to points *without* an fhrs:id
//     tag (a point already claimed by its own tagged establishment shouldn't also be
//     borrowed for a different nearby one via proximity).
//
// Usage:
//   1. Filter+export the extract (see the block comment above main() for the exact commands)
//   2. npx tsx -r dotenv/config scripts/match-osm.ts /path/to/filtered.geojson

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { token_set_ratio } from "fuzzball";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeBusinessName } from "../src/lib/business-name";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const LICENCE = "OpenStreetMap contributors (ODbL) — https://www.openstreetmap.org/copyright";
const SOURCE = "openstreetmap";
const BATCH_SIZE = 500;
const MATCH_PROGRESS_INTERVAL = 100_000;

const SPATIAL_RADIUS_METERS = 75;
const NAME_SCORE_THRESHOLD = 60;
const GRID_STEP_DEGREES = 0.001; // ~70-110m per cell at UK latitudes — see script header

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env before running this script.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// GeoJSON parsing
// ---------------------------------------------------------------------------

interface OsmProperties {
  "@type": string;
  "@id": number;
  "fhrs:id"?: string;
  name?: string;
  cuisine?: string;
  opening_hours?: string;
  takeaway?: string;
  delivery?: string;
  outdoor_seating?: string;
  wheelchair?: string;
  "diet:vegan"?: string;
  "diet:vegetarian"?: string;
  "diet:halal"?: string;
  website?: string;
  "contact:website"?: string;
  phone?: string;
  "contact:phone"?: string;
}

interface OsmFeature {
  type: "Feature";
  properties: OsmProperties;
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface OsmPoint {
  osmType: string;
  osmId: number;
  name: string;
  normalizedName: string;
  lat: number;
  lng: number;
  props: OsmProperties;
}

function nullableTag(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function loadOsmPoints(geojsonPath: string): Promise<{ byFhrsId: Map<number, OsmPoint>; unclaimed: OsmPoint[] }> {
  const raw = await readFile(geojsonPath, "utf-8");
  const data = JSON.parse(raw) as { features: OsmFeature[] };

  const byFhrsId = new Map<number, OsmPoint>();
  const unclaimed: OsmPoint[] = [];

  for (const feature of data.features) {
    const props = feature.properties;
    const name = props.name?.trim();
    const [lng, lat] = feature.geometry.coordinates;
    const fhrsIdTag = props["fhrs:id"] ? Number(props["fhrs:id"]) : null;

    const point: OsmPoint = {
      osmType: props["@type"],
      osmId: props["@id"],
      name: name ?? "",
      normalizedName: name ? normalizeBusinessName(name) : "",
      lat,
      lng,
      props,
    };

    if (fhrsIdTag && Number.isInteger(fhrsIdTag)) {
      byFhrsId.set(fhrsIdTag, point);
    } else if (point.normalizedName) {
      unclaimed.push(point);
    }
  }

  return { byFhrsId, unclaimed };
}

// ---------------------------------------------------------------------------
// Spatial index — grid-bucketed so a 75m search doesn't scan all unclaimed points
// ---------------------------------------------------------------------------

function gridKey(lat: number, lng: number): string {
  const latCell = Math.floor(lat / GRID_STEP_DEGREES);
  const lngCell = Math.floor(lng / GRID_STEP_DEGREES);
  return `${latCell}:${lngCell}`;
}

function buildSpatialIndex(points: OsmPoint[]): Map<string, OsmPoint[]> {
  const index = new Map<string, OsmPoint[]>();
  for (const point of points) {
    const key = gridKey(point.lat, point.lng);
    const bucket = index.get(key);
    if (bucket) bucket.push(point);
    else index.set(key, [point]);
  }
  return index;
}

// Haversine distance in meters.
const EARTH_RADIUS_METERS = 6_371_000;
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.asin(Math.sqrt(a));
}

interface SpatialMatch {
  point: OsmPoint;
  distanceMeters: number;
  nameScore: number;
}

/**
 * Finds the best spatial candidate within 75m, ranked by name similarity — the brief's
 * "spatial first, then name similarity to disambiguate" approach. Checks the establishment's
 * own grid cell plus its 8 neighbours, since a point just across a cell boundary is still a
 * legitimate candidate.
 */
function findSpatialMatch(
  normalizedName: string,
  lat: number,
  lng: number,
  index: Map<string, OsmPoint[]>,
): SpatialMatch | null {
  const latCell = Math.floor(lat / GRID_STEP_DEGREES);
  const lngCell = Math.floor(lng / GRID_STEP_DEGREES);

  let best: SpatialMatch | null = null;
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      const bucket = index.get(`${latCell + dLat}:${lngCell + dLng}`);
      if (!bucket) continue;

      for (const point of bucket) {
        const dist = distanceMeters(lat, lng, point.lat, point.lng);
        if (dist > SPATIAL_RADIUS_METERS) continue;

        const score = token_set_ratio(normalizedName, point.normalizedName);
        if (score < NAME_SCORE_THRESHOLD) continue;
        if (!best || score > best.nameScore || (score === best.nameScore && dist < best.distanceMeters)) {
          best = { point, distanceMeters: dist, nameScore: score };
        }
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Persisting results
// ---------------------------------------------------------------------------

type MatchMethod = "fhrs_id" | "spatial";

interface FinalMatch {
  method: MatchMethod;
  point: OsmPoint;
  distanceMeters: number | null;
  nameScore: number | null;
}

interface EstablishmentRow {
  fhrsId: number;
  businessName: string;
  latitude: number | null;
  longitude: number | null;
}

function websiteOf(props: OsmProperties): string | null {
  return nullableTag(props.website) ?? nullableTag(props["contact:website"]);
}
function phoneOf(props: OsmProperties): string | null {
  return nullableTag(props.phone) ?? nullableTag(props["contact:phone"]);
}

function matchRowTuple(fhrsId: number, match: FinalMatch, retrievedAt: Date) {
  const { props } = match.point;
  return Prisma.sql`(
    ${fhrsId}, ${match.point.osmType}, ${BigInt(match.point.osmId)}, ${match.method},
    ${match.distanceMeters}, ${match.nameScore},
    ${nullableTag(props.cuisine)}, ${nullableTag(props.opening_hours)}, ${nullableTag(props.takeaway)},
    ${nullableTag(props.delivery)}, ${nullableTag(props.outdoor_seating)}, ${nullableTag(props.wheelchair)},
    ${nullableTag(props["diet:vegan"])}, ${nullableTag(props["diet:vegetarian"])}, ${nullableTag(props["diet:halal"])},
    ${websiteOf(props)}, ${phoneOf(props)},
    ${SOURCE}, ${LICENCE}, ${retrievedAt}, now()
  )`;
}

async function persistMatches(matches: Map<number, FinalMatch>, retrievedAt: Date): Promise<void> {
  const entries = [...matches.entries()];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await prisma.$executeRaw`
      INSERT INTO "OsmMatch" (
        "fhrsId", "osmType", "osmId", "matchMethod", "distanceMeters", "nameScore",
        "cuisine", "openingHours", "takeaway", "delivery", "outdoorSeating", "wheelchair",
        "dietVegan", "dietVegetarian", "dietHalal", "website", "phone",
        "source", "licence", "retrievedAt", "matchedAt"
      )
      VALUES ${Prisma.join(batch.map(([fhrsId, match]) => matchRowTuple(fhrsId, match, retrievedAt)))}
      ON CONFLICT ("fhrsId") DO UPDATE SET
        "osmType" = EXCLUDED."osmType", "osmId" = EXCLUDED."osmId", "matchMethod" = EXCLUDED."matchMethod",
        "distanceMeters" = EXCLUDED."distanceMeters", "nameScore" = EXCLUDED."nameScore",
        "cuisine" = EXCLUDED."cuisine", "openingHours" = EXCLUDED."openingHours", "takeaway" = EXCLUDED."takeaway",
        "delivery" = EXCLUDED."delivery", "outdoorSeating" = EXCLUDED."outdoorSeating", "wheelchair" = EXCLUDED."wheelchair",
        "dietVegan" = EXCLUDED."dietVegan", "dietVegetarian" = EXCLUDED."dietVegetarian", "dietHalal" = EXCLUDED."dietHalal",
        "website" = EXCLUDED."website", "phone" = EXCLUDED."phone",
        "source" = EXCLUDED."source", "licence" = EXCLUDED."licence", "retrievedAt" = EXCLUDED."retrievedAt",
        "matchedAt" = EXCLUDED."matchedAt"
    `;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const geojsonPath = process.argv[2];
  if (!geojsonPath) {
    throw new Error("Usage: npx tsx -r dotenv/config scripts/match-osm.ts /path/to/filtered.geojson");
  }

  const retrievedAt = new Date();

  console.log(`Loading OSM points from ${geojsonPath}...`);
  const { byFhrsId, unclaimed } = await loadOsmPoints(geojsonPath);
  console.log(`Loaded ${byFhrsId.size.toLocaleString()} points with a direct fhrs:id tag, ${unclaimed.length.toLocaleString()} unclaimed named points.`);

  const spatialIndex = buildSpatialIndex(unclaimed);

  console.log("Loading active FSA establishments...");
  const establishments = await prisma.$queryRaw<EstablishmentRow[]>`
    SELECT "fhrsId", "businessName", "latitude", "longitude" FROM "Establishment" WHERE "isActive" = true
  `;
  console.log(`Matching ${establishments.length.toLocaleString()} establishments...`);

  const matches = new Map<number, FinalMatch>();
  const methodCounts: Record<MatchMethod, number> = { fhrs_id: 0, spatial: 0 };
  let processed = 0;

  for (const establishment of establishments) {
    const exact = byFhrsId.get(establishment.fhrsId);
    if (exact) {
      matches.set(establishment.fhrsId, { method: "fhrs_id", point: exact, distanceMeters: null, nameScore: null });
      methodCounts.fhrs_id++;
    } else if (establishment.latitude !== null && establishment.longitude !== null) {
      const normalizedName = normalizeBusinessName(establishment.businessName);
      if (normalizedName) {
        const spatial = findSpatialMatch(normalizedName, establishment.latitude, establishment.longitude, spatialIndex);
        if (spatial) {
          matches.set(establishment.fhrsId, {
            method: "spatial",
            point: spatial.point,
            distanceMeters: spatial.distanceMeters,
            nameScore: spatial.nameScore,
          });
          methodCounts.spatial++;
        }
      }
    }

    processed++;
    if (processed % MATCH_PROGRESS_INTERVAL === 0) {
      console.log(`  ...${processed.toLocaleString()} of ${establishments.length.toLocaleString()} matched against (${matches.size.toLocaleString()} found so far)`);
    }
  }

  console.log(`Writing ${matches.size.toLocaleString()} match results...`);
  await persistMatches(matches, retrievedAt);

  const unmatched = establishments.length - matches.size;
  console.log("\nMatch complete");
  console.log(`  Establishments checked: ${establishments.length.toLocaleString()}`);
  console.log(`  Exact (fhrs:id):        ${methodCounts.fhrs_id.toLocaleString()}`);
  console.log(`  Spatial (<=75m + name): ${methodCounts.spatial.toLocaleString()}`);
  console.log(`  Unmatched:              ${unmatched.toLocaleString()}`);
  console.log(`  Total coverage:         ${((matches.size / establishments.length) * 100).toFixed(1)}%`);
}

main()
  .catch((err) => {
    console.error("OSM match failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
