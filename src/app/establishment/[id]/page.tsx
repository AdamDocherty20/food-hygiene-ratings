import type { Metadata } from "next";
import { EstablishmentDetailClient } from "./EstablishmentDetailClient";
import { getBusinessCategoryByTypeId } from "@/lib/business-categories";
import { buildBreadcrumbJsonLd, buildEstablishmentJsonLd } from "@/lib/jsonld";
import { getLocalAuthorityByName } from "@/lib/local-authorities";
import { prisma } from "@/lib/prisma";
import { establishmentPath, parseFhrsIdParam } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";
const FALLBACK_TITLE = `Establishment Hygiene Rating | ${SITE_NAME}`;

// Selects everything generateMetadata and the JSON-LD builder need, in one shared shape —
// both run independently (Next.js does not share data between generateMetadata and the
// page body), so each does its own minimal Prisma query using this same select.
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));

  if (!Number.isInteger(fhrsId)) {
    return { title: FALLBACK_TITLE };
  }

  const establishment = await prisma.establishment.findFirst({
    where: { fhrsId, isActive: true },
    select: { businessName: true },
  });

  if (!establishment) {
    return { title: FALLBACK_TITLE };
  }

  return { title: `${establishment.businessName} Hygiene Rating | ${SITE_NAME}` };
}

export default async function EstablishmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));

  const establishment = Number.isInteger(fhrsId)
    ? await prisma.establishment.findFirst({ where: { fhrsId, isActive: true }, select: JSON_LD_SELECT })
    : null;

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
