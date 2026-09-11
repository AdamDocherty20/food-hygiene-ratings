import type { Metadata } from "next";
import { cache } from "react";
import { EstablishmentDetailClient } from "./EstablishmentDetailClient";
import { getBusinessCategoryByTypeId } from "@/lib/business-categories";
import { buildBreadcrumbJsonLd, buildEstablishmentJsonLd } from "@/lib/jsonld";
import { getLocalAuthorityByName } from "@/lib/local-authorities";
import { prisma } from "@/lib/prisma";
import { establishmentPath, parseFhrsIdParam } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";
const FALLBACK_TITLE = `Establishment Hygiene Rating | ${SITE_NAME}`;

// Ratings only change on the daily FSA sync, so an hour of staleness is a non-issue and
// buys a large cut in DB reads — matches the revalidate window already used on /area pages.
export const revalidate = 3600;

// Selects everything generateMetadata and the JSON-LD builder need, in one shared shape.
const JSON_LD_SELECT = {
  fhrsId: true,
  businessName: true,
  businessType: true,
  businessTypeId: true,
  addressLine1: true,
  addressLine2: true,
  addressLine3: true,
  addressLine4: true,
  postcode: true,
  latitude: true,
  longitude: true,
  ratingValue: true,
  ratingDate: true,
  schemeType: true,
  localAuthorityName: true,
} as const;

// Next.js runs generateMetadata and the page body as two independent functions, so without
// this they'd each issue their own Prisma query for the same row on every request — doubling
// DB reads (and, at 611k crawlable establishment pages, doubling egress). Wrapping in React's
// `cache()` dedupes same-argument calls within a single request, so both call sites share one
// query. Combined with `revalidate` above, repeat visits within the hour hit neither DB call.
const getEstablishmentForJsonLd = cache(async (fhrsId: number) =>
  prisma.establishment.findFirst({ where: { fhrsId, isActive: true }, select: JSON_LD_SELECT }),
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));

  if (!Number.isInteger(fhrsId)) {
    return { title: FALLBACK_TITLE };
  }

  const establishment = await getEstablishmentForJsonLd(fhrsId);

  if (!establishment) {
    return { title: FALLBACK_TITLE };
  }

  return { title: `${establishment.businessName} Hygiene Rating | ${SITE_NAME}` };
}

export default async function EstablishmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));

  const establishment = Number.isInteger(fhrsId) ? await getEstablishmentForJsonLd(fhrsId) : null;

  let breadcrumbJsonLd = null;
  if (establishment) {
    const authority = getLocalAuthorityByName(establishment.localAuthorityName);
    const category = getBusinessCategoryByTypeId(establishment.businessTypeId);
    breadcrumbJsonLd = buildBreadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      authority
        ? { name: authority.name, url: `${SITE_URL}/area/${authority.slug}` }
        : { name: establishment.localAuthorityName, url: SITE_URL },
      authority && category
        ? { name: category.label, url: `${SITE_URL}/area/${authority.slug}/${category.slug}` }
        : { name: establishment.businessType, url: SITE_URL },
      { name: establishment.businessName, url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}` },
    ]);
  }

  return (
    <>
      {establishment && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(buildEstablishmentJsonLd(establishment)) }}
          />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        </>
      )}
      <EstablishmentDetailClient />
    </>
  );
}
