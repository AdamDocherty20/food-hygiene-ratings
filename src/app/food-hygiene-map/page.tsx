import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FoodHygieneMapClient } from "@/components/foodHygieneMap/FoodHygieneMapClient";
import { MIN_COMPARE_AREA_SAMPLE } from "@/lib/area-queries";
import { formatDate } from "@/lib/format";
import { buildBreadcrumbJsonLd } from "@/lib/jsonld";
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

export default async function FoodHygieneMapPage() {
  // Same "most recent lastSeenAt across active rows" freshness signal sitemap.ts already
  // relies on — genuinely the last time the FSA sync touched the data, not a hardcoded date.
  const latestSync = await prisma.establishment.aggregate({ _max: { lastSeenAt: true }, where: { isActive: true } });
  const dataUpdatedAt = formatDate(latestSync._max.lastSeenAt?.toISOString() ?? null);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "UK Food Hygiene Map", url: `${SITE_URL}/food-hygiene-map` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

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

      <section className="mt-10 grid grid-cols-1 gap-8 border-t border-gray-200 pt-8 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Where this data comes from</h2>
          <p className="mt-2 text-sm text-gray-600">
            Every rating on this map is pulled directly from the Food Standards Agency&apos;s published data, synced
            once a day, covering restaurants, takeaways, cafés, pubs and other food businesses across England, Wales,
            Scotland and Northern Ireland. See the{" "}
            <Link href="/about" className="text-indigo-600 hover:underline">
              About &amp; FAQ page
            </Link>{" "}
            for the full breakdown of where the data comes from and how it&apos;s licensed.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-gray-900">What the ratings mean</h2>
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
            Improvement Required rather than a numeric score — Scottish establishments appear on the map with their
            actual FHIS status rather than a converted 0-5 rating.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">How often the data updates</h2>
          <p className="mt-2 text-sm text-gray-600">
            A sync job pulls the latest ratings from the Food Standards Agency once a day, so a newly published
            inspection result typically appears here within 24 hours.
          </p>

          <h2 className="mt-6 text-lg font-semibold text-gray-900">Compare areas methodology</h2>
          <p className="mt-2 text-sm text-gray-600">
            Compare areas ranks UK local authorities by their Food Hygiene Rating Scheme (FHRS) statistics only —
            average rating, and the percentage of rated establishments scoring 5, 4-5, or 0-2. Scotland&apos;s FHIS
            scheme has no numeric score to average or bucket this way, so Scottish local authorities are excluded
            from these specific calculations rather than shown with a converted or estimated figure.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            An area only appears once it has at least {MIN_COMPARE_AREA_SAMPLE} numerically rated establishments, so
            a small sample size can&apos;t produce a misleadingly perfect (or poor) score. Area markers are placed at
            the average location of every active establishment in that authority — an approximation, not an official
            administrative boundary. See{" "}
            <Link href="/guide/best-rated-areas" className="text-indigo-600 hover:underline">
              the UK&apos;s highest-rated areas
            </Link>{" "}
            for a ranked leaderboard using a stricter sample-size threshold.
          </p>
        </div>
      </section>
    </div>
  );
}
