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

export interface EstablishmentDetailResponse {
  data: Establishment;
  /** Average FHRS rating for the same local authority, or null for FHIS/no comparable data. */
  localAuthorityAverageRating: number | null;
  otherLocations: OtherLocation[];
  ratingHistory: RatingHistoryEntry[];
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
