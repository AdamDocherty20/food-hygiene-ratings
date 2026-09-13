import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CuisineNearMe } from "./CuisineNearMe";
import { getCuisineBySlug } from "@/lib/cuisines";

const SITE_NAME = "Should I Eat Here";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cuisine = getCuisineBySlug(slug);
  if (!cuisine) return {};

  return {
    title: `Best ${cuisine.label} Near You | ${SITE_NAME}`,
    description: `Find ${cuisine.label.toLowerCase()} restaurants and takeaways near you, with official UK food hygiene ratings for each one.`,
  };
}

// A dedicated, shareable URL per cuisine — deliberately not just a query-string filter on
// the homepage (`/?cuisine=slug`), same reasoning as /area/[slug] existing alongside plain
// search filters: a real URL is bookmarkable, indexable, and gives each cuisine its own
// page title, rather than every cuisine looking like "the same search page, different
// state" to a visitor or a crawler.
export default async function CuisinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cuisine = getCuisineBySlug(slug);
  if (!cuisine) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Best {cuisine.label} Near You</h1>
      <p className="mt-2 text-sm text-gray-600">
        Official UK food hygiene ratings for {cuisine.label.toLowerCase()} places near your current location.
      </p>
      <div className="mt-6">
        <CuisineNearMe slug={cuisine.slug} label={cuisine.label} />
      </div>
    </div>
  );
}
