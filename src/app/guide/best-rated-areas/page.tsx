import type { Metadata } from "next";
import Link from "next/link";
import { getAreaRatingLeaderboard } from "@/lib/area-queries";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { getLocalAuthorityByName } from "@/lib/local-authorities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";
const TITLE = "The UK's Highest-Rated Areas for Food Hygiene";
const DESCRIPTION =
  "Which UK local authorities have the best average food hygiene ratings? A data-backed ranking based on official Food Standards Agency inspections.";

export const metadata: Metadata = {
  title: `${TITLE} | ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/guide/best-rated-areas` },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/guide/best-rated-areas` },
};

// Ratings only change on the daily FSA sync — an hour of staleness on a leaderboard like
// this is a non-issue, same reasoning as the /area pages.
export const revalidate = 3600;

export default async function BestRatedAreasPage() {
  const leaderboard = await getAreaRatingLeaderboard(20);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Guide", url: `${SITE_URL}/guide` },
    { name: TITLE, url: `${SITE_URL}/guide/best-rated-areas` },
  ]);

  const itemListJsonLd = buildItemListJsonLd({
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/guide/best-rated-areas`,
    items: leaderboard
      .map((entry) => {
        const authority = getLocalAuthorityByName(entry.localAuthorityName);
        return authority ? { url: `${SITE_URL}/area/${authority.slug}`, name: authority.name } : null;
      })
      .filter((item): item is { url: string; name: string } => item !== null),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <nav className="text-sm text-gray-500">
        <Link href="/guide" className="hover:text-indigo-600 hover:underline">
          Guide
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{TITLE}</h1>
      <p className="mt-2 text-sm text-gray-600">
        Ranked by the average Food Hygiene Rating Scheme (FHRS) score across every rated business in each area, based
        on the official Food Standards Agency data this site syncs daily.
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
        <p>
          <strong className="font-semibold text-gray-700">Methodology:</strong> average of each area&apos;s
          numeric FHRS ratings (0–5), limited to areas with at least 300 rated businesses so the ranking reflects a
          real sample rather than a handful of scores. Scotland&apos;s Food Hygiene Information Scheme (FHIS) uses
          pass/improvement-required rather than a 0–5 score, so Scottish areas can&apos;t be ranked on this
          particular scale and don&apos;t appear here — that&apos;s a limitation of the comparison, not a
          reflection of hygiene standards there.
        </p>
      </div>

      <ol className="mt-6 flex flex-col divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {leaderboard.map((entry, index) => {
          const authority = getLocalAuthorityByName(entry.localAuthorityName);
          return (
            <li key={entry.localAuthorityName} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-sm font-semibold text-gray-400">{index + 1}</span>
                {authority ? (
                  <Link href={`/area/${authority.slug}`} className="font-medium text-indigo-600 hover:underline">
                    {entry.localAuthorityName}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-900">{entry.localAuthorityName}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">{entry.averageRating.toFixed(2)} avg</span>
                <span className="ml-2 text-xs text-gray-400">({entry.ratedCount.toLocaleString("en-GB")} rated)</span>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-sm text-gray-500">
        Want the detail behind a specific area?{" "}
        <Link href="/area" className="font-medium text-indigo-600 hover:underline">
          Browse every UK area
        </Link>{" "}
        to see its own top-rated restaurants, takeaways and shops.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Back to search
      </Link>
    </div>
  );
}
