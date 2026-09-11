import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { EstablishmentClientExtras } from "./EstablishmentClientExtras";
import { BackLink, DirectionsLink, EstablishmentDetailHero } from "./EstablishmentDetailServer";
import { getBusinessCategoryByTypeId } from "@/lib/business-categories";
import { EstablishmentMap, type MapPoint } from "@/components/EstablishmentMap";
import { SaveButton } from "@/components/SaveButton";
import { ShareButton } from "@/components/ShareButton";
import { getEstablishmentDetailData } from "@/lib/establishment-detail";
import { formatRatingDate, humanizeStatus, toEstablishmentSummary } from "@/lib/format";
import { buildBreadcrumbJsonLd, buildEstablishmentJsonLd } from "@/lib/jsonld";
import { getLocalAuthorityByName } from "@/lib/local-authorities";
import { establishmentPath, parseFhrsIdParam } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";
const FALLBACK_TITLE = `Establishment Hygiene Rating | ${SITE_NAME}`;

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

// Ratings only change on the daily FSA sync, so an hour of staleness is a non-issue and
// buys a large cut in DB reads — matches the revalidate window already used on /area pages.
export const revalidate = 3600;

// Next.js runs generateMetadata and the page body as two independent functions, so without
// this they'd each issue their own set of Prisma queries for the same row on every request —
// doubling DB reads (and, at 611k crawlable establishment pages, doubling egress). Wrapping
// in React's `cache()` dedupes same-argument calls within a single request, so both call
// sites share one fetch. Combined with `revalidate` above, repeat visits within the hour hit
// no DB call at all.
const getDetail = cache(getEstablishmentDetailData);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));

  if (!Number.isInteger(fhrsId)) {
    return { title: FALLBACK_TITLE };
  }

  const detail = await getDetail(fhrsId);

  if (!detail) {
    return { title: FALLBACK_TITLE };
  }

  const { establishment } = detail;
  const canonicalUrl = `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`;

  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(establishment.ratingValue);
  const ratingText = isNumericFhrs ? `${establishment.ratingValue}/5` : humanizeStatus(establishment.ratingValue);
  const inspectedText = establishment.ratingDate ? `, last inspected ${formatRatingDate(establishment.ratingDate)}` : "";
  const title = `${establishment.businessName} Hygiene Rating | ${SITE_NAME}`;
  const description = `Check the official FSA food hygiene rating for ${establishment.businessName} in ${establishment.localAuthorityName} — rated ${ratingText}${inspectedText}.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl },
  };
}

export default async function EstablishmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));
  if (!Number.isInteger(fhrsId)) notFound();

  const detail = await getDetail(fhrsId);
  if (!detail) notFound();

  const { establishment } = detail;

  // Old bare-ID links (/establishment/4) and stale slugs (a renamed business) both still
  // resolve correctly — fhrsId is the only part actually used for the lookup above — but
  // redirect to the canonical "id-slug" form here so crawlers and browsers converge on one
  // URL per establishment instead of indexing/bookmarking several for the same page.
  const canonicalPath = establishmentPath(establishment.fhrsId, establishment.businessName);
  if (`/establishment/${id}` !== canonicalPath) {
    redirect(canonicalPath);
  }

  const authority = getLocalAuthorityByName(establishment.localAuthorityName);
  const category = getBusinessCategoryByTypeId(establishment.businessTypeId);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    authority
      ? { name: authority.name, url: `${SITE_URL}/area/${authority.slug}` }
      : { name: establishment.localAuthorityName, url: SITE_URL },
    authority && category
      ? { name: category.label, url: `${SITE_URL}/area/${authority.slug}/${category.slug}` }
      : { name: establishment.businessType, url: SITE_URL },
    { name: establishment.businessName, url: `${SITE_URL}${canonicalPath}` },
  ]);

  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(establishment.ratingValue);
  const shareText = `${establishment.businessName} — food hygiene rating: ${
    isNumericFhrs ? `${establishment.ratingValue}/5` : humanizeStatus(establishment.ratingValue)
  }`;

  const mapPoints: MapPoint[] =
    establishment.latitude !== null && establishment.longitude !== null
      ? [
          {
            id: establishment.id,
            lat: establishment.latitude,
            lng: establishment.longitude,
            label: establishment.businessName,
            href: canonicalPath,
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildEstablishmentJsonLd(establishment)) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="flex items-center justify-between gap-4">
        <BackLink />
        <div className="flex items-center gap-2">
          {establishment.latitude !== null && establishment.longitude !== null && (
            <DirectionsLink lat={establishment.latitude} lng={establishment.longitude} />
          )}
          <SaveButton establishment={toEstablishmentSummary(establishment)} />
          <ShareButton title={establishment.businessName} text={shareText} />
        </div>
      </div>

      <EstablishmentDetailHero detail={detail} />

      {mapPoints.length > 0 && (
        <div className="mt-6">
          <EstablishmentMap points={mapPoints} heightClassName="h-[350px]" />
        </div>
      )}

      <EstablishmentClientExtras fhrsId={establishment.fhrsId} summary={toEstablishmentSummary(establishment)} />
    </div>
  );
}
