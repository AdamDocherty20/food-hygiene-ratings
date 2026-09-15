// Shared between /api/establishments/map-clusters (which produces these) and the
// food-hygiene-map client components (which consume them) — kept in a plain lib module
// rather than imported from the route file itself, so client bundles never risk pulling
// in server-only route code just for a type import.

export interface MapClusterCell {
  lat: number;
  lng: number;
  count: number;
}

export interface MapEstablishmentPoint {
  id: number;
  fhrsId: number;
  businessName: string;
  businessType: string;
  ratingValue: string;
  schemeType: string;
  ratingDate: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postcode: string | null;
  localAuthorityName: string;
  latitude: number;
  longitude: number;
}

export interface MapClustersResponse {
  mode: "points" | "clusters";
  points: MapEstablishmentPoint[];
  clusters: MapClusterCell[];
  totalCount: number;
}
