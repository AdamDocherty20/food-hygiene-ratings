import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaEstablishmentList } from "@/components/area/AreaEstablishmentList";
import { AreaPagination } from "@/components/area/AreaPagination";
import { getTopRatedInArea, TOP_RATED_LIMIT } from "@/lib/area-queries";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { LONDON_BOROUGHS } from "@/lib/local-authorities";
import { establishmentPath } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const revalidate = 3600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  const pageSuffix = page > 1 ? ` (Page ${page})` : "";
  const title = `Food Hygiene Ratings in London${pageSuffix} | ${SITE_NAME}`;
  const description =
    "Browse the best-rated restaurants, takeaways, pubs and food businesses across all 33 London boroughs, ranked by official Food Standards Agency hygiene ratings.";
  const url = `${SITE_URL}/area/london${page > 1 ? `?page=${page}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

// A bespoke hub page, not a dynamic /area/[slug] match — London has no local authority of
// its own in the FSA data (it's split across 33 boroughs, see LONDON_BOROUGHS), so this
// is the one UK city of its size with no landing page unless we build it specifically.
// Sitting as a static route under /area means it takes routing priority over the dynamic
// [slug] segment for this exact path, without needing to special-case "london" inside that
// already-well-tested shared route.
export default async function LondonAreaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const page = parsePage((await searchParams).page);
  const { establishments, total, totalPages } = await getTopRatedInArea(LONDON_BOROUGHS, undefined, page);
  if (total === 0 || page > totalPages) notFound();

  const basePath = "/area/london";
  const url = `${SITE_URL}${basePath}${page > 1 ? `?page=${page}` : ""}`;
  const jsonLd = buildItemListJsonLd({
    name: `Food businesses in London${page > 1 ? ` (page ${page})` : ""}`,
    description: "Food hygiene rated establishments across London, UK, based on official Food Standards Agency inspections.",
    url,
    items: establishments.map((establishment) => ({
      url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`,
      name: establishment.businessName,
    })),
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "All areas", url: `${SITE_URL}/area` },
    { name: "London", url: `${SITE_URL}${basePath}` },
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

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Food Hygiene Ratings in London</h1>
      <p className="mt-2 text-sm text-gray-600">
        {total.toLocaleString("en-GB")} food businesses across London&apos;s 33 boroughs have an official Food
        Standards Agency hygiene rating.{" "}
        {page === 1
          ? "Here are the top-rated places, based on each business's most recent inspection."
          : `Showing ${rangeStart.toLocaleString("en-GB")}–${rangeEnd.toLocaleString("en-GB")}, ranked by each business's most recent inspection.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {BUSINESS_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={`/area/london/${category.slug}`}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
          >
            Best {category.label} in London
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <AreaEstablishmentList establishments={establishments} />
      </div>

      <AreaPagination basePath={basePath} page={page} totalPages={totalPages} />

      <p className="mt-8 text-sm text-gray-500">
        Looking for a specific borough?{" "}
        <Link href="/area" className="font-medium text-indigo-600 hover:underline">
          Browse all UK areas
        </Link>
        , including each London borough individually.
      </p>
    </div>
  );
}
