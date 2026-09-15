import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FoodHygieneMapClient } from "@/components/foodHygieneMap/FoodHygieneMapClient";
import { RankingsReport } from "@/components/foodHygieneMap/RankingsReport";
import { getAreaHygieneStats, getRegionalHygieneBreakdown, MIN_COMPARE_AREA_SAMPLE } from "@/lib/area-queries";
import { rankAreas } from "@/lib/area-rankings";
import { formatDate } from "@/lib/format";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { prisma } from "@/lib/prisma";
import { FHRS_SCALE, FHRS_SCORE_COLOR_CLASSES } from "@/lib/rating-scale";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "UK Food Hygiene Map | Should I Eat Here?";
const DESCRIPTION =
  "Explore food hygiene ratings across the UK with our interactive map. Search restaurants, takeaways, cafés and other food businesses to see their latest hygiene rating.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/food-hygiene-map` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/food-hygiene-map` },
};

// This page now does real server-side data fetching (the rankings below, "Data last
// updated") on top of what used to be static copy — without a revalidate window it would
// bake into the build and never reflect the daily FSA sync until the next deploy. Same
// hourly window as /area and /blog.
export const revalidate = 3600;

export default async function FoodHygieneMapPage() {
  // Same "most recent lastSeenAt across active rows" freshness signal sitemap.ts already
  // relies on — genuinely the last time the FSA sync touched the data, not a hardcoded date.
  const latestSync = await prisma.establishment.aggregate({ _max: { lastSeenAt: true }, where: { isActive: true } });
  const dataUpdatedAt = formatDate(latestSync._max.lastSeenAt?.toISOString() ?? null);

  const [areaStats, regionalBreakdown] = await Promise.all([getAreaHygieneStats(), getRegionalHygieneBreakdown()]);
  const rankedAreas = rankAreas(areaStats);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "UK Food Hygiene Map", url: `${SITE_URL}/food-hygiene-map` },
  ]);

  // The top 10 is the most citation-worthy slice of the rankings below — eligible for a
  // rich "list" result in search. Built from the same rankAreas() output the page itself
  // renders, so the two can never disagree about order.
  const top10JsonLd = buildItemListJsonLd({
    name: "UK's best-rated areas for food hygiene",
    description: "UK local authorities ranked by average Food Hygiene Rating Scheme (FHRS) score.",
    url: `${SITE_URL}/food-hygiene-map`,
    items: rankedAreas
      .slice(0, 10)
      .filter((area) => area.slug)
      .map((area) => ({ url: `${SITE_URL}/area/${area.slug}`, name: area.localAuthorityName })),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(top10JsonLd) }} />

      <nav className="text-sm text-gray-500">
        <Link href="/" className="hover:text-indigo-600 hover:underline">
          Home
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">UK Food Hygiene Map</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-600 sm:text-base">
        Explore food hygiene ratings for restaurants, takeaways, cafés, pubs and other food businesses across the UK.
        Search for an establishment or zoom into the interactive map below to see the latest available food hygiene
        rating, or switch to Compare areas to see how local authorities stack up against each other.
      </p>
      {dataUpdatedAt && <p className="mt-2 text-xs text-gray-400">Data last updated: {dataUpdatedAt}</p>}

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="flex h-[560px] w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-500 shadow-sm">
              Loading map…
            </div>
          }
        >
          <FoodHygieneMapClient />
        </Suspense>
      </div>

      <RankingsReport
        stats={areaStats}
        regional={regionalBreakdown}
        minSample={MIN_COMPARE_AREA_SAMPLE}
        dataUpdatedAt={dataUpdatedAt}
      />

      <section id="methodology" className="mt-10 scroll-mt-20 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold text-gray-900">Methodology</h2>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Where this data comes from</h3>
            <p className="mt-2 text-sm text-gray-600">
              Every rating on this map is pulled directly from the Food Standards Agency&apos;s published data,
              synced once a day, covering restaurants, takeaways, cafés, pubs and other food businesses across
              England, Wales, Scotland and Northern Ireland. See the{" "}
              <Link href="/about" className="text-indigo-600 hover:underline">
                About &amp; FAQ page
              </Link>{" "}
              for the full breakdown of where the data comes from and how it&apos;s licensed.
            </p>

            <h3 className="mt-6 text-base font-semibold text-gray-900">What the ratings mean</h3>
            <p className="mt-2 text-sm text-gray-600">
              England, Wales and Northern Ireland use the Food Hygiene Rating Scheme (FHRS), a 0-5 scale shown on the
              map as a coloured, numbered marker:
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
              {FHRS_SCALE.map((entry) => (
                <li key={entry.score} className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${FHRS_SCORE_COLOR_CLASSES[entry.score]}`}
                    aria-hidden
                  >
                    {entry.score}
                  </span>
                  {entry.shortLabel}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-gray-600">
              Scotland uses a separate scheme, the Food Hygiene Information Scheme (FHIS), which awards Pass or
              Improvement Required rather than a numeric score. Scottish businesses appear on the map with their
              FHIS result, but Scotland isn&apos;t included in the rankings above because there&apos;s no numeric
              score to average.
            </p>

            <h3 className="mt-6 text-base font-semibold text-gray-900">How often it updates</h3>
            <p className="mt-2 text-sm text-gray-600">
              The underlying data syncs daily, so the live rankings and Compare areas map can shift day to day. Rely
              on the &ldquo;Data last updated&rdquo; date at the top of this page for exactly how current the figures
              you&apos;re looking at are, rather than assuming they match any earlier visit.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900">How the ranking works</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-gray-600">
              <li>
                Each local authority is ranked by its average FHRS rating (0-5) across all currently rated
                businesses, with every business weighted equally.
              </li>
              <li>Ties (areas sharing the same average to two decimal places) are broken by the larger rated-business sample, then alphabetically.</li>
              <li>&ldquo;Rated 5&rdquo; is the percentage of an area&apos;s rated businesses holding a 5.</li>
              <li>Businesses awaiting inspection, exempt, or without a numeric rating aren&apos;t counted.</li>
              <li>
                An area is only ranked once it has at least {MIN_COMPARE_AREA_SAMPLE} numerically rated businesses,
                so a small sample can&apos;t produce a misleadingly perfect (or poor) result. Areas below that
                threshold, and all of Scotland, are shown in grey on the Compare areas map rather than omitted
                silently.
              </li>
              <li>
                Nation and London figures are calculated across every rated business in those areas combined —
                unlike the area ranking itself, they have no minimum-sample threshold, so larger authorities
                naturally carry more weight in the total.
              </li>
              <li>
                Nation groupings follow each local authority&apos;s location. London covers the 32 London boroughs
                plus the City of London Corporation. The major cities table uses the UK Core Cities group, minus
                Glasgow, since Scotland isn&apos;t ranked here.
              </li>
            </ul>

            <h3 className="mt-6 text-base font-semibold text-gray-900">Sources</h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
              <li>Food Standards Agency, food hygiene rating data (Open Government Licence)</li>
              <li>
                Chartered Institute of Environmental Health,{" "}
                <a
                  href="https://www.cieh.org/policy/campaigns/mandatory-display-of-food-hygiene-ratings/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  mandatory display of food hygiene ratings
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
