export interface Establishment {
  id: number;
  fhrsId: number;
  localAuthorityBusinessId: string;
  businessName: string;
  businessType: string;
  businessTypeId: number;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postcode: string | null;
  ratingValue: string;
  ratingKey: string;
  ratingDate: string | null;
  schemeType: string;
  latitude: number | null;
  longitude: number | null;
  localAuthorityName: string;
  localAuthorityCode: string;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EstablishmentWithDistance extends Establishment {
  distanceMiles: number;
}

/**
 * The minimal snapshot of an establishment persisted client-side for the "saved" and
 * "recently viewed" localStorage lists (see src/lib/saved-establishments.ts and
 * src/lib/recently-viewed.ts) — just enough to render a summary card without an extra
 * API round trip per entry. May go slightly stale if the establishment is re-rated later;
 * both list pages link through to the live establishment page for the current rating.
 */
export interface EstablishmentSummary {
  fhrsId: number;
  businessName: string;
  businessType: string;
  addressLine1: string | null;
  postcode: string | null;
  ratingValue: string;
  schemeType: string;
  ratingDate: string | null;
}

/** Another active branch of the same chain — see GET /api/establishments/[id]. */
export interface OtherLocation {
  fhrsId: number;
  businessName: string;
  addressLine1: string | null;
  postcode: string | null;
  ratingValue: string;
  schemeType: string;
  ratingDate: string | null;
}

export interface RatingHistoryEntry {
  ratingValue: string;
  schemeType: string;
  ratingDate: string | null;
  recordedAt: string;
}

/** FHRS component score breakdown — lower is better for each. See src/lib/fsa-api.ts. */
export interface FsaScores {
  hygiene: number;
  structural: number;
  confidenceInManagement: number;
}

/** Extra fields fetched live from the FSA's per-establishment API — see src/lib/fsa-api.ts. */
export interface FsaDetail {
  phone: string | null;
  rightToReply: string | null;
  newRatingPending: boolean;
  scores: FsaScores | null;
}

export interface EstablishmentDetailResponse {
  data: Establishment;
  /** Average FHRS rating for the same local authority, or null for FHIS/no comparable data. */
  localAuthorityAverageRating: number | null;
  otherLocations: OtherLocation[];
  ratingHistory: RatingHistoryEntry[];
  /** Null if the FSA's live API call failed or timed out — not an error, just less info. */
  fsaDetail: FsaDetail | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchResponse {
  data: Establishment[];
  pagination: PaginationMeta;
}

export interface NearbyResponse {
  data: EstablishmentWithDistance[];
  pagination: PaginationMeta;
  query: { lat: number; lng: number; radiusMiles: number };
}

export interface BusinessType {
  businessTypeId: number;
  businessType: string;
}

export interface BusinessTypesResponse {
  data: BusinessType[];
}

export interface ApiErrorResponse {
  error: string;
}
