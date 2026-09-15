import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AreaRankings } from "@/components/foodHygieneMap/AreaRankings";
import { FoodHygieneMapClient } from "@/components/foodHygieneMap/FoodHygieneMapClient";
import { getAreaHygieneStats, MIN_COMPARE_AREA_SAMPLE } from "@/lib/area-queries";
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

  const areaStats = await getAreaHygieneStats();
  const rankedAreas = [...areaStats].sort((a, b) => b.averageRating - a.averageRating);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "UK Food Hygiene Map", url: `${SITE_URL}/food-hygiene-map` },
  ]);

  // The top 10 is the most citation-worthy slice of the rankings below — eligible for a
  // rich "list" result in search.
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

      <AreaRankings stats={areaStats} minSample={MIN_COMPARE_AREA_SAMPLE} dataUpdatedAt={dataUpdatedAt} />

      <section className="mt-10 border-t border-gray-200 pt-8">
        <h2 className="text-lg font-semibold text-gray-900">What the rankings show</h2>
        <div className="mt-3 flex max-w-3xl flex-col gap-3 text-sm text-gray-600">
          <p>
            An area&apos;s average score only means as much as the sample behind it. A 4.94 average across more than
            4,000 rated businesses, as in Dorset, reflects thousands of individual inspections settling into a
            consistent pattern over time. A similar average from an area nearer this ranking&apos;s minimum of{" "}
            {MIN_COMPARE_AREA_SAMPLE} rated businesses carries a much smaller sample, and should be read with a bit
            more caution.
          </p>
          <p>
            Several of the highest-scoring areas in this ranking are rural or semi-rural district councils — Dorset,
            Forest of Dean, Cotswold, North Kesteven and West Oxfordshire all sit near the top, alongside larger
            towns such as Thanet, Ipswich, Wrexham and Stockton-on-Tees. Businesses in these areas tend to see lower
            staff turnover, and in some cases a smaller share of the higher-risk premises — large-scale takeaways and
            fast-food outlets among them — that make up a bigger proportion of food businesses in busy city centres.
          </p>
          <p>
            The lower end leans towards dense, urban local authorities. Newham, Waltham Forest, Ealing, Barking and
            Dagenham, Enfield and Camden — all London boroughs — sit among the lowest average scores, alongside
            Wigan, Bolton and Walsall. This is worth reading as a pattern rather than a verdict on any one borough: a
            higher concentration of food businesses generally means a higher concentration of every type of business,
            including the kind more likely to pick up a lower score on a given inspection, such as independent
            takeaways and small kitchens with high staff turnover. It&apos;s not proof of a single cause — Blaenau
            Gwent&apos;s presence on the same list, a small post-industrial Welsh valleys authority with little in
            common with inner London, is a reminder that no single explanation fits every area here.
          </p>
          <p>
            None of this means a specific restaurant in a lower-scoring area is unsafe, or that every business in a
            top-ranked one is spotless. An area&apos;s average is calculated across every FHRS-rated business
            currently active there, weighted equally regardless of size or type, so it smooths out a lot of
            individual variation. A newly opened business still &ldquo;Awaiting Inspection&rdquo;, one that&apos;s
            had a poor inspection but not yet had the chance to fix and request a re-visit, and a handful of
            long-established five-rated regulars can all sit within the same borough&apos;s average.
          </p>
          <p>
            If you&apos;re checking somewhere specific, this ranking is a starting point, not a substitute for
            looking up the business itself. Every establishment on this site links through to its own page, showing
            its current rating, the date of its most recent inspection, and its rating history where available —
            that&apos;s the figure that actually matters before you book a table or order in. Use the map above to
            explore ratings street by street, or search directly for a business or postcode.
          </p>
          <p>
            All figures are drawn from the Food Standards Agency&apos;s own published data and recalculated daily —
            see the methodology below for how the averages and sample threshold are worked out. Feel free to
            reference or link to this page if you&apos;re writing about UK food hygiene standards.
          </p>
        </div>
      </section>

      <section className="mt-10 border-t border-gray-200 pt-8">
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
              Improvement Required rather than a numeric score — Scottish establishments appear on the map with
              their actual FHIS status rather than a converted 0-5 rating.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900">How often the data updates</h3>
            <p className="mt-2 text-sm text-gray-600">
              A sync job pulls the latest ratings from the Food Standards Agency once a day, so a newly published
              inspection result typically appears here within 24 hours.
            </p>

            <h3 className="mt-6 text-base font-semibold text-gray-900">Rankings &amp; Compare areas methodology</h3>
            <p className="mt-2 text-sm text-gray-600">
              Both the rankings above and Compare areas use UK local authorities&apos; Food Hygiene Rating Scheme
              (FHRS) statistics only — average rating, and the percentage of rated establishments scoring 5, 4-5, or
              0-2. Scotland&apos;s FHIS scheme has no numeric score to average or bucket this way, so Scottish local
              authorities are excluded from these specific calculations rather than shown with a converted or
              estimated figure.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              An area only appears in the rankings, and is shaded on the Compare areas map, once it has at least{" "}
              {MIN_COMPARE_AREA_SAMPLE} numerically rated establishments, so a small sample size can&apos;t produce a
              misleadingly perfect (or poor) score — areas below that threshold, and all of Scotland, are shown in
              grey on the map rather than omitted silently.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
