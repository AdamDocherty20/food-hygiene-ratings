import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaEstablishmentList } from "@/components/area/AreaEstablishmentList";
import { getTopRatedInArea } from "@/lib/area-queries";
import { getBusinessCategoryBySlug } from "@/lib/business-categories";
import { buildItemListJsonLd } from "@/lib/jsonld";
import { getLocalAuthorityBySlug } from "@/lib/local-authorities";
import { establishmentPath } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";

// Same reasoning as the parent /area/[slug] page: daily-refreshed data, no
// generateStaticParams (361 areas x 8 categories = 2,888 combinations — rendering all of
// those at build time would badly slow down deploys for pages most of which will get
// little traffic). notFound() below handles combinations with zero matches rather than
// rendering an empty page for a business type that doesn't happen to exist in that area.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; category: string }>;
}): Promise<Metadata> {
  const { slug, category: categorySlug } = await params;
  const authority = getLocalAuthorityBySlug(slug);
  const category = getBusinessCategoryBySlug(categorySlug);
  if (!authority || !category) return { title: `Page Not Found | ${SITE_NAME}` };

  const title = `Best Rated ${category.label} in ${authority.name} | ${SITE_NAME}`;
  const description = `The best-rated ${category.pluralLabel} in ${authority.name}, ranked by official Food Standards Agency hygiene ratings.`;
  const url = `${SITE_URL}/area/${authority.slug}/${category.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

export default async function AreaCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; category: string }>;
}) {
  const { slug, category: categorySlug } = await params;
  const authority = getLocalAuthorityBySlug(slug);
  const category = getBusinessCategoryBySlug(categorySlug);
  if (!authority || !category) notFound();

  const { establishments, total } = await getTopRatedInArea(authority.name, category.businessTypeIds);
  if (total === 0) notFound();

  const url = `${SITE_URL}/area/${authority.slug}/${category.slug}`;
  const jsonLd = buildItemListJsonLd({
    name: `Best rated ${category.pluralLabel} in ${authority.name}`,
    description: `The best-rated ${category.pluralLabel} in ${authority.name}, UK, based on official Food Standards Agency inspections.`,
    url,
    items: establishments.map((establishment) => ({
      url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`,
      name: establishment.businessName,
    })),
  });

  // The search page's businessTypeId filter only takes one id at a time; categories that
  // map to more than one raw FSA type (e.g. "Supermarkets & Shops") just link through
  // with the first — still narrows the search meaningfully, even if not pixel-perfect.
  const searchParams = new URLSearchParams({
    localAuthorityName: authority.name,
    businessTypeId: String(category.businessTypeIds[0]),
    sort: "rating_desc",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <Link href="/area" className="hover:text-indigo-600 hover:underline">
          All areas
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/area/${authority.slug}`} className="hover:text-indigo-600 hover:underline">
          {authority.name}
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
        Best Rated {category.label} in {authority.name}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {total.toLocaleString("en-GB")} {category.pluralLabel} in {authority.name} have an official Food Standards
        Agency hygiene rating. Here are the top-rated, based on each business&apos;s most recent inspection.
      </p>

      <div className="mt-6">
        <AreaEstablishmentList establishments={establishments} />
      </div>

      <Link
        href={`/?${searchParams.toString()}`}
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        See all {total.toLocaleString("en-GB")} {category.pluralLabel} in {authority.name}
      </Link>
    </div>
  );
}
