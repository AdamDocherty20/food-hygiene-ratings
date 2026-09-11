import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaEstablishmentList } from "@/components/area/AreaEstablishmentList";
import { AreaPagination } from "@/components/area/AreaPagination";
import { getTopRatedInArea, TOP_RATED_LIMIT } from "@/lib/area-queries";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { getLocalAuthorityBySlug } from "@/lib/local-authorities";
import { establishmentPath } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";

// Parses the ?page= query param used by AreaPagination — anything not a positive
// integer falls back to page 1 rather than erroring, since a stray/garbage value here
// isn't worth a 404 (unlike a page number past the real end, which is out of range).
function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

// Ratings only change on the daily FSA sync, so an hour of staleness on these
// crawler-facing landing pages is an easy trade for not hitting the DB on every visit.
// No generateStaticParams: with 361 areas this would slow every build considerably for
// pages that are rarely the very first hit anyway — ISR renders and caches them
// on-demand instead (see sitemap.ts for the top-N subset submitted directly to crawlers).
export const revalidate = 3600;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const authority = getLocalAuthorityBySlug(slug);
  if (!authority) return { title: `Area Not Found | ${SITE_NAME}` };

  const page = parsePage((await searchParams).page);
  const pageSuffix = page > 1 ? ` (Page ${page})` : "";
  const title = `Food Hygiene Ratings in ${authority.name}${pageSuffix} | ${SITE_NAME}`;
  const description = `Browse the best-rated restaurants, takeaways, pubs and food businesses in ${authority.name}, ranked by official Food Standards Agency hygiene ratings.`;
  const url = `${SITE_URL}/area/${authority.slug}${page > 1 ? `?page=${page}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

export default async function AreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { slug } = await params;
  const authority = getLocalAuthorityBySlug(slug);
  if (!authority) notFound();

  const page = parsePage((await searchParams).page);
  const { establishments, total, totalPages } = await getTopRatedInArea(authority.name, undefined, page);
  if (total === 0 || page > totalPages) notFound();

  const basePath = `/area/${authority.slug}`;
  const url = `${SITE_URL}${basePath}${page > 1 ? `?page=${page}` : ""}`;
  const jsonLd = buildItemListJsonLd({
    name: `Food businesses in ${authority.name}${page > 1 ? ` (page ${page})` : ""}`,
    description: `Food hygiene rated establishments in ${authority.name}, UK, based on official Food Standards Agency inspections.`,
    url,
    items: establishments.map((establishment) => ({
      url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`,
      name: establishment.businessName,
    })),
  });

  const searchHref = `/?localAuthorityName=${encodeURIComponent(authority.name)}&sort=rating_desc`;

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "All areas", url: `${SITE_URL}/area` },
    { name: authority.name, url: `${SITE_URL}${basePath}` },
  ]);

  const rangeStart = (page - 1) * TOP_RATED_LIMIT + 1;
  const rangeEnd = Math.min(page * TOP_RATED_LIMIT, total);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav className="text-sm text-gray-500">
        <Link href="/area" className="hover:text-indigo-600 hover:underline">
          All areas
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Food Hygiene Ratings in {authority.name}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {total.toLocaleString("en-GB")} food businesses in {authority.name} have an official Food Standards Agency
        hygiene rating.{" "}
        {page === 1
          ? "Here are the top-rated places, based on each business's most recent inspection."
          : `Showing ${rangeStart.toLocaleString("en-GB")}–${rangeEnd.toLocaleString("en-GB")}, ranked by each business's most recent inspection.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {BUSINESS_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={`/area/${authority.slug}/${category.slug}`}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
          >
            Best {category.label} in {authority.name}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <AreaEstablishmentList establishments={establishments} />
      </div>

      <AreaPagination basePath={basePath} page={page} totalPages={totalPages} />

      <Link
        href={searchHref}
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Search all {total.toLocaleString("en-GB")} establishments in {authority.name}
      </Link>
    </div>
  );
}
