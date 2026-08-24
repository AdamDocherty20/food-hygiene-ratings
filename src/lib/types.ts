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
