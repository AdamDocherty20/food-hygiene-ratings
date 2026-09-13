import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaEstablishmentList } from "@/components/area/AreaEstablishmentList";
import { AreaPagination } from "@/components/area/AreaPagination";
import { getTopRatedInArea, TOP_RATED_LIMIT } from "@/lib/area-queries";
import { getBusinessCategoryBySlug } from "@/lib/business-categories";
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
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getBusinessCategoryBySlug(categorySlug);
  if (!category) return { title: `Page Not Found | ${SITE_NAME}` };

  const page = parsePage((await searchParams).page);
  const pageSuffix = page > 1 ? ` (Page ${page})` : "";
  const title = `Best Rated ${category.label} in London${pageSuffix} | ${SITE_NAME}`;
  const description = `The best-rated ${category.pluralLabel} across London, ranked by official Food Standards Agency hygiene ratings.`;
  const url = `${SITE_URL}/area/london/${category.slug}${page > 1 ? `?page=${page}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

// Sibling to /area/london — same "static route beats the dynamic /area/[slug]/[category]
// match" reasoning, see that page's own comment.
export default async function LondonAreaCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { category: categorySlug } = await params;
  const category = getBusinessCategoryBySlug(categorySlug);
  if (!category) notFound();

  const page = parsePage((await searchParams).page);
  const { establishments, total, totalPages } = await getTopRatedInArea(LONDON_BOROUGHS, category.businessTypeIds, page);
  if (total === 0 || page > totalPages) notFound();

  const basePath = `/area/london/${category.slug}`;
  const url = `${SITE_URL}${basePath}${page > 1 ? `?page=${page}` : ""}`;
  const jsonLd = buildItemListJsonLd({
    name: `${category.pluralLabel} in London${page > 1 ? ` (page ${page})` : ""}`,
    description: `${category.pluralLabel} in London, UK, based on official Food Standards Agency inspections.`,
    url,
    items: establishments.map((establishment) => ({
      url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`,
      name: establishment.businessName,
    })),
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "All areas", url: `${SITE_URL}/area` },
    { name: "London", url: `${SITE_URL}/area/london` },
    { name: category.label, url: `${SITE_URL}${basePath}` },
  ]);

  const rangeStart = (page - 1) * TOP_RATED_LIMIT + 1;
  const rangeEnd = Math.min(page * TOP_RATED_LIMIT, total);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <Link href="/area" className="hover:text-indigo-600 hover:underline">
          All areas
        </Link>
        <span aria-hidden>/</span>
        <Link href="/area/london" className="hover:text-indigo-600 hover:underline">
          London
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Best Rated {category.label} in London</h1>
      <p className="mt-2 text-sm text-gray-600">
        {total.toLocaleString("en-GB")} {category.pluralLabel} across London have an official Food Standards Agency
        hygiene rating.{" "}
        {page === 1
          ? "Here are the top-rated, based on each business's most recent inspection."
          : `Showing ${rangeStart.toLocaleString("en-GB")}–${rangeEnd.toLocaleString("en-GB")}, ranked by each business's most recent inspection.`}
      </p>

      <div className="mt-6">
        <AreaEstablishmentList establishments={establishments} />
      </div>

      <AreaPagination basePath={basePath} page={page} totalPages={totalPages} />
    </div>
  );
}
