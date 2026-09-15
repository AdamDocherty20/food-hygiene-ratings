import type { FlyToTarget } from "@/components/foodHygieneMap/HygieneMapExplorer";
import { LOCAL_AUTHORITIES } from "@/lib/local-authorities";

// Loose UK postcode matcher (outward code, or full postcode with or without a space) —
// permissive on purpose: it only decides *which* existing search param to query with
// (postcode vs. plain name), and /api/establishments/search's own partial ILIKE match is
// what actually finds anything, so a false-positive match here just costs one extra
// (harmless) query rather than breaking the search.
const POSTCODE_LIKE = /^[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}$/i;

const AUTHORITY_ZOOM = 11;
const POSTCODE_ZOOM = 14;
// Deliberately closer than a plain "zoomed in" level — confirmed while building this that
// a dense city centre (e.g. central Leeds) can still have 400+ establishments in view at
// zoom 16, which keeps map-clusters in "clusters" mode and means the specific business the
// visitor searched for never renders as its own marker, so its popup can never open. 18 is
// tight enough (city-block scale) that even a dense high street comes in well under
// INDIVIDUAL_MARKER_THRESHOLD.
const ESTABLISHMENT_ZOOM = 18;

export interface LocationSearchResult {
  flyTo: FlyToTarget;
  /** Human-readable description of what matched, for a toast/confirmation if needed. */
  matchedLabel: string;
}

interface EstablishmentSearchRow {
  id: number;
  fhrsId: number;
  businessName: string;
  latitude: number | null;
  longitude: number | null;
}

async function searchEstablishments(params: Record<string, string>): Promise<EstablishmentSearchRow[]> {
  const query = new URLSearchParams({ pageSize: "1", ...params });
  const res = await fetch(`/api/establishments/search?${query.toString()}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { data: EstablishmentSearchRow[] };
  return body.data;
}

/**
 * Resolves a free-text map search (establishment name, town/city, or postcode) into a
 * map target — reusing the existing /api/establishments/search endpoint for all three
 * rather than adding a separate geocoding service, on the theory that "the nearest
 * matching establishment's coordinates" is a perfectly good stand-in for "this place's
 * coordinates" when no dedicated place/postcode database exists in this app.
 *
 * Resolution order: a local authority name match zooms to that area (no popup); a
 * postcode-shaped query zooms to the first establishment at that postcode (no popup);
 * anything else is treated as an establishment name and, if found, zooms directly to it
 * with its popup opened. Returns null if nothing matched at all.
 */
export async function resolveLocationSearch(rawQuery: string): Promise<LocationSearchResult | null> {
  const query = rawQuery.trim();
  if (!query) return null;

  const authorityMatch = LOCAL_AUTHORITIES.find((a) => a.name.toLowerCase() === query.toLowerCase());
  if (authorityMatch) {
    const rows = await searchEstablishments({ localAuthorityName: authorityMatch.name });
    const row = rows[0];
    if (row?.latitude !== null && row?.latitude !== undefined && row.longitude !== null && row.longitude !== undefined) {
      return {
        flyTo: { lat: row.latitude, lng: row.longitude, zoom: AUTHORITY_ZOOM },
        matchedLabel: authorityMatch.name,
      };
    }
  }

  if (POSTCODE_LIKE.test(query)) {
    const rows = await searchEstablishments({ postcode: query });
    const row = rows[0];
    if (row?.latitude !== null && row?.latitude !== undefined && row.longitude !== null && row.longitude !== undefined) {
      return {
        flyTo: { lat: row.latitude, lng: row.longitude, zoom: POSTCODE_ZOOM },
        matchedLabel: query.toUpperCase(),
      };
    }
  }

  const nameRows = await searchEstablishments({ name: query, sort: "name" });
  const nameRow = nameRows[0];
  if (nameRow?.latitude !== null && nameRow?.latitude !== undefined && nameRow.longitude !== null && nameRow.longitude !== undefined) {
    return {
      flyTo: { lat: nameRow.latitude, lng: nameRow.longitude, zoom: ESTABLISHMENT_ZOOM, openPopupForId: nameRow.id },
      matchedLabel: nameRow.businessName,
    };
  }

  // Last resort: a partial local authority name match — catches multi-word authorities
  // typed loosely, e.g. "Bournemouth" for "Bournemouth, Christchurch and Poole", which the
  // exact (case-insensitive) match above wouldn't.
  const partialAuthorityMatch = LOCAL_AUTHORITIES.find((a) => a.name.toLowerCase().includes(query.toLowerCase()));
  if (partialAuthorityMatch) {
    const rows = await searchEstablishments({ localAuthorityName: partialAuthorityMatch.name });
    const row = rows[0];
    if (row?.latitude !== null && row?.latitude !== undefined && row.longitude !== null && row.longitude !== undefined) {
      return {
        flyTo: { lat: row.latitude, lng: row.longitude, zoom: AUTHORITY_ZOOM },
        matchedLabel: partialAuthorityMatch.name,
      };
    }
  }

  return null;
}
