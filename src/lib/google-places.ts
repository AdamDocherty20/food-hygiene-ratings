import { prisma } from "@/lib/prisma";

const SEARCH_TIMEOUT_MS = 5000;

export interface EstablishmentPhoto {
  url: string;
  attribution: string | null;
}

interface EstablishmentForPhotoLookup {
  fhrsId: number;
  businessName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postcode: string | null;
}

/**
 * Resolves a real photo for an establishment via the Places API (New) — gated entirely on
 * GOOGLE_PLACES_SERVER_API_KEY/NEXT_PUBLIC_GOOGLE_PLACES_BROWSER_API_KEY being set, so the
 * feature is fully inert (no network calls, no cost) until both exist. See README
 * "Deploying" for setup and src/lib/establishment-detail.ts for how this is wired in.
 *
 * Place Photo requests are billed per call and have no free-tier headroom worth relying on
 * at this app's scale (611k+ establishments) — this is deliberately called only from the
 * establishment detail page, which is itself hourly-revalidated (ISR), not from any
 * per-keystroke or per-list-item surface. See the PlacePhotoMatch model for why only the
 * googlePlaceId (not the photo itself) is cached.
 *
 * Never throws — any Places API failure (timeout, bad response, no match, no photo) just
 * returns null, and the caller falls back to the category placeholder image.
 */
export async function getEstablishmentPhoto(establishment: EstablishmentForPhotoLookup): Promise<EstablishmentPhoto | null> {
  const serverKey = process.env.GOOGLE_PLACES_SERVER_API_KEY;
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_BROWSER_API_KEY;
  if (!serverKey || !browserKey) return null;

  try {
    const placeId = await getOrFindPlaceId(establishment, serverKey);
    if (!placeId) return null;

    const photo = await fetchFirstPhoto(placeId, serverKey);
    if (!photo?.name) return null;

    return {
      url: `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1200&key=${browserKey}`,
      attribution: photo.authorAttributions?.[0]?.displayName ?? null,
    };
  } catch {
    return null;
  }
}

async function getOrFindPlaceId(establishment: EstablishmentForPhotoLookup, serverKey: string): Promise<string | null> {
  const cached = await prisma.placePhotoMatch.findUnique({
    where: { fhrsId: establishment.fhrsId },
    select: { googlePlaceId: true },
  });
  if (cached) return cached.googlePlaceId;

  const addressParts = [
    establishment.addressLine1,
    establishment.addressLine2,
    establishment.addressLine3,
    establishment.addressLine4,
    establishment.postcode,
  ].filter((part): part is string => Boolean(part?.trim()));
  const textQuery = [establishment.businessName, ...addressParts].join(", ");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": serverKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  // Cache a null match too (a business with no Google listing shouldn't be re-searched on
  // every future ISR regeneration), but only for a genuine "no match" — not for a transient
  // API failure, which should just retry next time instead of getting stuck as a permanent
  // miss.
  if (!response.ok) throw new Error(`Places text search failed: ${response.status}`);
  const data = (await response.json()) as { places?: { id?: string }[] };
  const placeId = data.places?.[0]?.id ?? null;

  await prisma.placePhotoMatch.upsert({
    where: { fhrsId: establishment.fhrsId },
    create: { fhrsId: establishment.fhrsId, googlePlaceId: placeId },
    update: { googlePlaceId: placeId, matchedAt: new Date() },
  });

  return placeId;
}

interface PlacePhoto {
  name?: string;
  authorAttributions?: { displayName?: string }[];
}

async function fetchFirstPhoto(placeId: string, serverKey: string): Promise<PlacePhoto | null> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": serverKey, "X-Goog-FieldMask": "photos" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Place details failed: ${response.status}`);
  const data = (await response.json()) as { photos?: PlacePhoto[] };
  return data.photos?.[0] ?? null;
}
