import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaEstablishmentList } from "@/components/area/AreaEstablishmentList";
import { getTopRatedInArea } from "@/lib/area-queries";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { buildItemListJsonLd } from "@/lib/jsonld";
import { getLocalAuthorityBySlug } from "@/lib/local-authorities";
import { establishmentPath } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";

// Ratings only change on the daily FSA sync, so an hour of staleness on these
// crawler-facing landing pages is an easy trade for not hitting the DB on every visit.
// No generateStaticParams: with 361 areas this would slow every build considerably for
// pages that are rarely the very first hit anyway — ISR renders and caches them
// on-demand instead (see sitemap.ts for the top-N subset submitted directly to crawlers).
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const authority = getLocalAuthorityBySlug(slug);
  if (!authority) return { title: `Area Not Found | ${SITE_NAME}` };

  const title = `Food Hygiene Ratings in ${authority.name} | ${SITE_NAME}`;
  const description = `Browse the best-rated restaurants, takeaways, pubs and food businesses in ${authority.name}, ranked by official Food Standards Agency hygiene ratings.`;
  const url = `${SITE_URL}/area/${authority.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const authority = getLocalAuthorityBySlug(slug);
  if (!authority) notFound();

  const { establishments, total } = await getTopRatedInArea(authority.name);
  if (total === 0) notFound();

  const url = `${SITE_URL}/area/${authority.slug}`;
  const jsonLd = buildItemListJsonLd({
    name: `Top rated food businesses in ${authority.name}`,
    description: `The best-rated food hygiene establishments in ${authority.name}, UK, based on official Food Standards Agency inspections.`,
    url,
    items: establishments.map((establishment) => ({
      url: `${SITE_URL}${establishmentPath(establishment.fhrsId, establishment.businessName)}`,
      name: establishment.businessName,
    })),
  });

  const searchHref = `/?localAuthorityName=${encodeURIComponent(authority.name)}&sort=rating_desc`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="text-sm text-gray-500">
        <Link href="/area" className="hover:text-indigo-600 hover:underline">
          All areas
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Food Hygiene Ratings in {authority.name}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {total.toLocaleString("en-GB")} food businesses in {authority.name} have an official Food Standards Agency
        hygiene rating. Here are the top-rated places, based on each business&apos;s most recent inspection.
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

      <Link
        href={searchHref}
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        See all {total.toLocaleString("en-GB")} establishments in {authority.name}
      </Link>
    </div>
  );
}
