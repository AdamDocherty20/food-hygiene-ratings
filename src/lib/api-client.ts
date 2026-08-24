import type { ApiErrorResponse, BusinessTypesResponse, Establishment, SearchResponse } from "@/lib/types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

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

export function searchEstablishments(params: URLSearchParams): Promise<SearchResponse> {
  return getJson<SearchResponse>(`/api/establishments/search?${params.toString()}`);
}

export function fetchBusinessTypes(): Promise<BusinessTypesResponse> {
  return getJson<BusinessTypesResponse>("/api/establishments/business-types");
}

export async function fetchEstablishment(fhrsId: string): Promise<Establishment> {
  const result = await getJson<{ data: Establishment }>(`/api/establishments/${fhrsId}`);
  return result.data;
}
