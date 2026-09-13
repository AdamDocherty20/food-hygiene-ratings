import type {
  ApiErrorResponse,
  BusinessTypesResponse,
  EstablishmentDetailResponse,
  NearbyMapPointsResponse,
  NearbyResponse,
  SearchResponse,
} from "@/lib/types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      if (body.error) message = body.error;
    } catch {
      // Response wasn't JSON — fall back to the generic message above.
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

async function getJson<T>(url: string): Promise<T> {
  return readJsonOrThrow<T>(await fetch(url));
}

// The claim form is the first thing in this app that writes to the server from the
// client — every other call here is a GET. Kept as a thin sibling to getJson (same
// ApiError/error-shape handling) rather than a generic fetch wrapper with method/body
// options, since there's exactly one caller so far and a speculative generic API would
// just be unused surface area.
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return readJsonOrThrow<T>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export function searchEstablishments(params: URLSearchParams): Promise<SearchResponse> {
  return getJson<SearchResponse>(`/api/establishments/search?${params.toString()}`);
}

export function searchNearby(params: URLSearchParams): Promise<NearbyResponse> {
  return getJson<NearbyResponse>(`/api/establishments/nearby?${params.toString()}`);
}

export function searchNearbyMapPoints(params: URLSearchParams): Promise<NearbyMapPointsResponse> {
  return getJson<NearbyMapPointsResponse>(`/api/establishments/nearby/map?${params.toString()}`);
}

export function fetchBusinessTypes(): Promise<BusinessTypesResponse> {
  return getJson<BusinessTypesResponse>("/api/establishments/business-types");
}

export function fetchEstablishment(fhrsId: string): Promise<EstablishmentDetailResponse> {
  return getJson<EstablishmentDetailResponse>(`/api/establishments/${fhrsId}`);
}
