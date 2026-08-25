import { formatAddress, formatRatingDate, humanizeStatus } from "@/lib/format";
import { establishmentPath } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

interface JsonLdEstablishment {
  fhrsId: number;
  businessName: string;
  businessType: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  ratingValue: string;
  ratingDate: Date | string | null;
  schemeType: string;
  localAuthorityName: string;
}

/**
 * Builds schema.org LocalBusiness structured data for an establishment page. Deliberately
 * uses `additionalProperty` (a PropertyValue) for the FHRS/FHIS rating rather than
 * `aggregateRating` — aggregateRating is meant for review-derived scores, and Google's
 * structured data guidelines treat misusing it for non-review ratings (like an official
 * hygiene inspection) as spam. additionalProperty carries the same info without that risk.
 */
export function buildEstablishmentJsonLd(establishment: JsonLdEstablishment) {
  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(establishment.ratingValue);
  const ratingDate = establishment.ratingDate instanceof Date ? establishment.ratingDate.toISOString() : establishment.ratingDate;

  const ratingDescription = isNumericFhrs
    ? `Food hygiene rating: ${establishment.ratingValue} out of 5`
    : `Food hygiene rating: ${humanizeStatus(establishment.ratingValue)}`;

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: establishment.businessName,
    url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`,
    additionalType: establishment.businessType,
    address: {
      "@type": "PostalAddress",
      streetAddress: formatAddress(establishment),
      addressLocality: establishment.localAuthorityName,
      postalCode: establishment.postcode ?? undefined,
      addressCountry: "GB",
    },
    ...(establishment.latitude !== null && establishment.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: establishment.latitude, longitude: establishment.longitude } }
      : {}),
    additionalProperty: {
      "@type": "PropertyValue",
      name: "UK Food Hygiene Rating",
      value: establishment.ratingValue,
      description: `${ratingDescription} (${establishment.schemeType}). Last inspected: ${formatRatingDate(
        ratingDate,
      )}. Source: Food Standards Agency.`,
    },
  };
}

/**
 * Builds schema.org ItemList structured data for a curated "top rated" landing page
 * (see src/app/area/[slug]) — helps these pages qualify for rich list-style search
 * result treatment, separately from the LocalBusiness markup on each linked-to page.
 */
export function buildItemListJsonLd(params: {
  name: string;
  description: string;
  url: string;
  items: { url: string; name: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: params.name,
    description: params.description,
    url: params.url,
    itemListElement: params.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.url,
      name: item.name,
    })),
  };
}
