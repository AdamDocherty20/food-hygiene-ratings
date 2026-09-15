import { RankingTable } from "@/components/foodHygieneMap/RankingTable";
import type { AreaHygieneStats, RegionalHygieneBreakdown } from "@/lib/area-queries";
import { rankAreas, rankAreasByPctRated5, type RankedArea } from "@/lib/area-rankings";
import { LONDON_BOROUGHS } from "@/lib/local-authorities";

interface RankingsReportProps {
  stats: AreaHygieneStats[];
  regional: RegionalHygieneBreakdown;
  minSample: number;
  dataUpdatedAt: string | null;
}

// Named UK "Core Cities" (minus Glasgow, since Scotland isn't ranked here) — the only
// hand-picked list on this page; everything else is derived from the live data. Display
// label kept separate from the lookup key since a couple read more naturally shortened
// ("Newcastle" rather than "Newcastle Upon Tyne") for a table heading.
const CORE_CITIES: { key: string; label: string }[] = [
  { key: "Nottingham City", label: "Nottingham" },
  { key: "Leeds", label: "Leeds" },
  { key: "Bristol", label: "Bristol" },
  { key: "Sheffield", label: "Sheffield" },
  { key: "Belfast City", label: "Belfast" },
  { key: "Newcastle Upon Tyne", label: "Newcastle upon Tyne" },
  { key: "Manchester", label: "Manchester" },
  { key: "Cardiff", label: "Cardiff" },
  { key: "Liverpool", label: "Liverpool" },
  { key: "Birmingham", label: "Birmingham" },
];

function formatNaturalList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// "83rd", "319th", "1st" — needed because these ranks are live-computed and can land on
// any number, unlike a hand-written article where the author picks which ones to write out.
function ordinal(n: number): string {
  const remainder10 = n % 10;
  const remainder100 = n % 100;
  if (remainder10 === 1 && remainder100 !== 11) return `${n}st`;
  if (remainder10 === 2 && remainder100 !== 12) return `${n}nd`;
  if (remainder10 === 3 && remainder100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function TocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="text-indigo-600 hover:underline">
        {children}
      </a>
    </li>
  );
}

export function RankingsReport({ stats, regional, minSample, dataUpdatedAt }: RankingsReportProps) {
  const ranked = rankAreas(stats);
  const byPct5 = rankAreasByPctRated5(stats);

  const best10 = ranked.slice(0, 10);
  const worst10 = [...ranked.slice(-10)].reverse();
  const top5Pct5 = byPct5.slice(0, 5);
  const bottom5Pct5 = [...byPct5.slice(-5)].reverse();

  const totalRated = ranked.reduce((sum, a) => sum + a.ratedCount, 0);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const gapMultiple = (best.pctRated5 / worst.pctRated5).toFixed(1);

  const londonInRanked = ranked.filter((a) => LONDON_BOROUGHS.includes(a.localAuthorityName));
  const londonInTop100 = londonInRanked.filter((a) => a.rank <= 100).length;
  const londonInBottom10 = londonInRanked.filter((a) => a.rank > ranked.length - 10).length;
  const londonInBottom50 = londonInRanked.filter((a) => a.rank > ranked.length - 50).length;

  const nationLeader = [...regional.nations].sort((a, b) => b.pctRated5 - a.pctRated5)[0];

  const byVolume = [...ranked].sort((a, b) => b.ratedCount - a.ratedCount);
  const biggest = byVolume[0];

  // The "second place" tie group — every area sharing rank 2's exact average, computed
  // rather than named directly so this paragraph can't drift out of sync with the table
  // above it.
  const secondPlaceGroup = ranked.filter((a) => a.rank > 1 && a.averageRating === ranked[1].averageRating);
  const bestWales = ranked.find((a) => a.nation === "Wales");
  const bestNI = ranked.find((a) => a.nation === "Northern Ireland");

  const top10ByVolume = byVolume.slice(0, 10);
  const bestOfVolume10 = [...top10ByVolume].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const worstOfVolume10 = [...top10ByVolume].sort((a, b) => b.rank - a.rank).slice(0, 3);

  // The clearest "read the sample size" example for the methodology paragraph below —
  // the smallest sample among the current top 30, wherever that happens to land.
  const smallestSampleInTop30 = [...ranked.slice(0, 30)].sort((a, b) => a.ratedCount - b.ratedCount)[0];

  const cityRows: RankedArea[] = CORE_CITIES.map(({ key, label }) => {
    const area = ranked.find((a) => a.localAuthorityName === key);
    return area ? { ...area, localAuthorityName: label } : null;
  }).filter((a): a is RankedArea => a !== null);
  const bestCity = [...cityRows].sort((a, b) => a.rank - b.rank)[0];
  const secondBestCity = [...cityRows].sort((a, b) => a.rank - b.rank)[1];

  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
        Best &amp; Worst UK Areas for Food Hygiene {new Date().getFullYear()}
      </h2>
      {dataUpdatedAt && (
        <p className="mt-1 text-sm text-gray-500 italic">
          Figures correct as of the Food Standards Agency data sync on {dataUpdatedAt}. Feel free to cite, embed or
          link to this page.
        </p>
      )}

      <div className="mt-4 flex max-w-3xl flex-col gap-3 text-sm text-gray-600">
        <p>
          A good review tells you the food was tasty. A food hygiene rating tells you what an inspector found when
          they looked behind the kitchen door, and that picture changes a lot depending on where you are.
        </p>
        <p>
          Across England, Wales and Northern Ireland, roughly {Math.round(regional.ukTotal.pctRated5)}% of rated food
          businesses hold the top score of 5 (&ldquo;Very Good&rdquo;). In the best-performing area, that rises to
          almost {Math.round(best.pctRated5)}%. In the lowest, it&apos;s fewer than half.
        </p>
        <p>
          To find out where standards are highest, Should I Eat Here ranked {ranked.length} local authorities using
          the Food Standards Agency&apos;s own published ratings. Between them, they cover around{" "}
          {totalRated.toLocaleString("en-GB")} numerically rated restaurants, takeaways, cafés, pubs and other food
          businesses. We compared each area on its average rating and the share of businesses scoring a 5, then
          broke the results down by nation, by city and for London.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h3 className="text-sm font-semibold tracking-wide text-gray-700 uppercase">Key facts</h3>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-gray-700">
          <li>
            <strong>The best areas for food hygiene</strong> are {formatNaturalList(best10.slice(0, 5).map((a) => a.localAuthorityName))}.
          </li>
          <li>
            <strong>The worst areas for food hygiene</strong> are {formatNaturalList(worst10.slice(0, 5).map((a) => a.localAuthorityName))}.
          </li>
          <li>
            <strong>A {gapMultiple}x gap:</strong> {best.pctRated5}% of rated businesses in {best.localAuthorityName} have a 5, about {gapMultiple} times
            the share in {worst.localAuthorityName} ({worst.pctRated5}%).
          </li>
          <li>
            <strong>London dominates the bottom of the table.</strong> {londonInBottom10} of the 10 lowest-scoring areas are London
            boroughs, and only {londonInTop100} of London&apos;s {londonInRanked.length} local authorities make the top 100.
          </li>
          <li>
            <strong>{nationLeader.nation} leads the three nations</strong> ranked here, with around {Math.round(nationLeader.pctRated5)}% of
            rated businesses on a 5, ahead of{" "}
            {formatNaturalList(
              regional.nations
                .filter((n) => n.nation !== nationLeader.nation)
                .sort((a, b) => b.pctRated5 - a.pctRated5)
                .map((n) => `${n.nation} (${Math.round(n.pctRated5)}%)`),
            )}
            .
          </li>
          <li>
            <strong>The UK&apos;s biggest food scene ranks near the bottom.</strong> {biggest.localAuthorityName} has more rated
            businesses than anywhere else ({biggest.ratedCount.toLocaleString("en-GB")}) but ranks {ordinal(biggest.rank)} of{" "}
            {ranked.length}.
          </li>
        </ul>
      </div>

      <nav className="mt-8 rounded-xl border border-gray-200 bg-white p-5" aria-label="Report contents">
        <h3 className="text-sm font-semibold tracking-wide text-gray-700 uppercase">Contents</h3>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          <TocLink href="#main-findings">Main findings</TocLink>
          <TocLink href="#in-depth">In-depth look at the best areas for food hygiene</TocLink>
          <TocLink href="#nations-cities-london">How the nations, cities and London compare</TocLink>
          <TocLink href="#what-rankings-show">What the rankings show</TocLink>
          <TocLink href="#detailed-findings">Detailed findings</TocLink>
          <TocLink href="#methodology">Methodology</TocLink>
        </ul>
      </nav>

      <div id="main-findings" className="mt-10 scroll-mt-20">
        <h3 className="text-lg font-semibold text-gray-900">Main findings</h3>

        <div className="mt-3 max-h-96 overflow-y-auto rounded-xl border border-gray-200">
          <div className="p-4">
            <RankingTable areas={ranked} variant="simple" />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          No. 1 = best food hygiene. Ties (areas sharing the same average to two decimal places) are broken by the
          larger rated-business sample, then alphabetically — see methodology below.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-green-700 uppercase">Top 10 best-rated areas</h4>
            <div className="mt-3">
              <RankingTable areas={best10} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-red-700 uppercase">Top 10 worst-rated areas</h4>
            <div className="mt-3">
              <RankingTable areas={worst10} />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h4 className="text-base font-semibold text-gray-900">Share of businesses rated 5</h4>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Highest</p>
                <ol className="mt-1 flex flex-col gap-1 text-gray-700">
                  {top5Pct5.map((a) => (
                    <li key={a.localAuthorityName} className="flex justify-between gap-2">
                      <span>
                        {a.rank}. {a.localAuthorityName}
                      </span>
                      <span className="font-semibold text-gray-900">{a.pctRated5}%</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Lowest</p>
                <ol className="mt-1 flex flex-col gap-1 text-gray-700">
                  {bottom5Pct5.map((a) => (
                    <li key={a.localAuthorityName} className="flex justify-between gap-2">
                      <span>
                        {a.rank}. {a.localAuthorityName}
                      </span>
                      <span className="font-semibold text-gray-900">{a.pctRated5}%</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Best vs worst: {(top5Pct5[0].pctRated5 / bottom5Pct5[0].pctRated5).toFixed(1)}x difference (
              {top5Pct5[0].localAuthorityName} vs {bottom5Pct5[0].localAuthorityName}).
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-gray-900">Biggest food scenes</h4>
            <p className="mt-1 text-xs text-gray-500">
              Best- and worst-ranked among the 10 areas with the most rated businesses.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Best-ranked</p>
                <ol className="mt-1 flex flex-col gap-1 text-gray-700">
                  {bestOfVolume10.map((a) => (
                    <li key={a.localAuthorityName}>
                      {a.localAuthorityName} ({a.ratedCount.toLocaleString("en-GB")}) — rank {a.rank}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Worst-ranked</p>
                <ol className="mt-1 flex flex-col gap-1 text-gray-700">
                  {worstOfVolume10.map((a) => (
                    <li key={a.localAuthorityName}>
                      {a.localAuthorityName} ({a.ratedCount.toLocaleString("en-GB")}) — rank {a.rank}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="in-depth" className="mt-10 scroll-mt-20">
        <h3 className="text-lg font-semibold text-gray-900">In-depth look at the best areas for food hygiene</h3>

        <div className="mt-4 flex flex-col gap-5 text-sm text-gray-600">
          <div>
            <h4 className="text-base font-semibold text-gray-900">{best.localAuthorityName}</h4>
            <p className="mt-1">
              {best.localAuthorityName} is the best area in the UK for food hygiene, and it isn&apos;t especially
              close. Its average rating of {best.averageRating.toFixed(2)} is the highest of any local authority in
              the ranking, and {best.pctRated5}% of its {best.ratedCount.toLocaleString("en-GB")} rated food
              businesses hold a 5, also the highest share anywhere.
            </p>
            <p className="mt-1">
              Put another way, just {Math.round(best.ratedCount * (1 - best.pctRated5 / 100)).toLocaleString("en-GB")}{" "}
              of {best.localAuthorityName}&apos;s rated businesses fall short of the top score. In{" "}
              {worst.localAuthorityName}, at the other end of the table, it&apos;s more than half.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-gray-900">{ranked[1].localAuthorityName}</h4>
            <p className="mt-1">
              {ranked[1].localAuthorityName} ranks second, with an average of {ranked[1].averageRating.toFixed(2)} and{" "}
              {ranked[1].pctRated5}% of businesses rated 5. What makes that result stand out is scale.{" "}
              {ranked[1].localAuthorityName} has {ranked[1].ratedCount.toLocaleString("en-GB")} rated food
              businesses — far more than any other area near the top of the table.
            </p>
            {secondPlaceGroup.length > 1 && (
              <p className="mt-1">
                {secondPlaceGroup.length} areas share that {ranked[1].averageRating.toFixed(2)} average:{" "}
                {formatNaturalList(secondPlaceGroup.map((a) => a.localAuthorityName))}. The gap between them comes
                down to their share of 5s and sample size, which is why the table above orders them by both.
              </p>
            )}
          </div>

          <div>
            <h4 className="text-base font-semibold text-gray-900">Best in Wales and Northern Ireland</h4>
            <p className="mt-1">
              {bestWales && (
                <>
                  <strong>{bestWales.localAuthorityName}</strong> is the top-rated area in Wales, ranked{" "}
                  {ordinal(bestWales.rank)} overall, with an average of {bestWales.averageRating.toFixed(2)} and{" "}
                  {bestWales.pctRated5}% of businesses rated 5.{" "}
                </>
              )}
              {bestNI && (
                <>
                  <strong>{bestNI.localAuthorityName}</strong> leads Northern Ireland, ranked {ordinal(bestNI.rank)} overall,
                  with an average of {bestNI.averageRating.toFixed(2)} and {bestNI.pctRated5}% rated 5.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div id="nations-cities-london" className="mt-10 scroll-mt-20">
        <h3 className="text-lg font-semibold text-gray-900">How the nations, cities and London compare</h3>

        <div className="mt-4">
          <h4 className="text-base font-semibold text-gray-900">By nation</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  <th className="py-2 pr-3">Nation</th>
                  <th className="py-2 pr-3">Areas ranked</th>
                  <th className="py-2 pr-3">Rated businesses</th>
                  <th className="py-2 pr-3">Rated 5</th>
                  <th className="py-2 pr-3">Best area</th>
                  <th className="py-2">Worst area</th>
                </tr>
              </thead>
              <tbody>
                {[...regional.nations]
                  .sort((a, b) => b.pctRated5 - a.pctRated5)
                  .map((n) => {
                    const nationAreas = ranked.filter((a) => a.nation === n.nation);
                    const bestArea = nationAreas[0];
                    const worstArea = nationAreas[nationAreas.length - 1];
                    return (
                      <tr key={n.nation} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-3 font-medium text-gray-900">{n.nation}</td>
                        <td className="py-2 pr-3 text-gray-600 tabular-nums">{n.areas}</td>
                        <td className="py-2 pr-3 text-gray-600 tabular-nums">{n.ratedCount.toLocaleString("en-GB")}</td>
                        <td className="py-2 pr-3 text-gray-600 tabular-nums">around {Math.round(n.pctRated5)}%</td>
                        <td className="py-2 pr-3 text-indigo-600">
                          {bestArea?.localAuthorityName} ({bestArea?.rank})
                        </td>
                        <td className="py-2 text-indigo-600">
                          {worstArea?.localAuthorityName} ({worstArea?.rank})
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Every one of Northern Ireland&apos;s 11 council areas finishes inside the top 250, and its lowest-ranked
            area is Belfast, its biggest city. Wales and Northern Ireland are also the two nations where businesses
            are legally required to display their rating (since 2013 and 2016 respectively) — in England, display is
            still voluntary.
          </p>
        </div>

        <div className="mt-8">
          <h4 className="text-base font-semibold text-gray-900">London vs the rest of the UK</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  <th className="py-2 pr-3"> </th>
                  <th className="py-2 pr-3">Areas</th>
                  <th className="py-2 pr-3">Rated businesses</th>
                  <th className="py-2">Rated 5</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-medium text-gray-900">London</td>
                  <td className="py-2 pr-3 text-gray-600 tabular-nums">{regional.london.areas}</td>
                  <td className="py-2 pr-3 text-gray-600 tabular-nums">{regional.london.ratedCount.toLocaleString("en-GB")}</td>
                  <td className="py-2 text-gray-600 tabular-nums">around {Math.round(regional.london.pctRated5)}%</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-medium text-gray-900">Rest of England, Wales and NI</td>
                  <td className="py-2 pr-3 text-gray-600 tabular-nums">{regional.restOfUk.areas}</td>
                  <td className="py-2 pr-3 text-gray-600 tabular-nums">{regional.restOfUk.ratedCount.toLocaleString("en-GB")}</td>
                  <td className="py-2 text-gray-600 tabular-nums">around {Math.round(regional.restOfUk.pctRated5)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            London&apos;s best performer is {londonInRanked[0]?.localAuthorityName} ({ordinal(londonInRanked[0]?.rank ?? 0)}),
            followed by {londonInRanked[1]?.localAuthorityName} ({ordinal(londonInRanked[1]?.rank ?? 0)}) and{" "}
            {londonInRanked[2]?.localAuthorityName} ({ordinal(londonInRanked[2]?.rank ?? 0)}). {londonInBottom50} of the 50
            lowest-ranked areas in the whole table are London boroughs.
          </p>
        </div>

        <div className="mt-8">
          <h4 className="text-base font-semibold text-gray-900">Major cities</h4>
          <div className="mt-3">
            <RankingTable areas={cityRows} />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {bestCity.localAuthorityName} is the clear outlier among the UK&apos;s big cities. It&apos;s the only one
            {bestCity.rank <= 100 ? " in the top 100, " : " "}sitting {secondBestCity.rank - bestCity.rank} places
            above {secondBestCity.localAuthorityName}, the next-best.
          </p>
        </div>
      </div>

      <div id="what-rankings-show" className="mt-10 scroll-mt-20">
        <h3 className="text-lg font-semibold text-gray-900">What the rankings show</h3>
        <div className="mt-3 flex max-w-3xl flex-col gap-3 text-sm text-gray-600">
          <p>
            An area&apos;s average only means as much as the sample behind it. A {ranked[1].averageRating.toFixed(2)}{" "}
            average across {ranked[1].ratedCount.toLocaleString("en-GB")} rated businesses, as in{" "}
            {ranked[1].localAuthorityName}, reflects thousands of individual inspections. A similar average from an
            area nearer this ranking&apos;s minimum of {minSample} rated businesses rests on a much smaller sample,
            so read it with a bit more caution. {smallestSampleInTop30.localAuthorityName} ({ordinal(smallestSampleInTop30.rank)}
            , with {smallestSampleInTop30.ratedCount} rated businesses) is the clearest example here.
          </p>
          <p>
            Many of the highest-scoring areas are rural or semi-rural district councils, including{" "}
            {formatNaturalList(best10.slice(1, 6).map((a) => a.localAuthorityName))}. They sit alongside larger towns
            such as {formatNaturalList(best10.slice(6, 10).map((a) => a.localAuthorityName))}, so this isn&apos;t
            simply a countryside-versus-town split.
          </p>
          <p>
            The lower end leans towards dense, urban authorities. {formatNaturalList(worst10.slice(0, 6).map((a) => a.localAuthorityName))}{" "}
            (mostly London boroughs) are among the lowest scorers, alongside{" "}
            {formatNaturalList(worst10.slice(6).map((a) => a.localAuthorityName))}. That&apos;s worth reading as a
            pattern rather than a verdict on any one borough. Busy urban areas tend to have a larger mix of
            independent takeaways and small kitchens, which may be more likely to pick up a lower score on a given
            inspection. But no single explanation fits every area — {worst.nation === "Wales" ? worst.localAuthorityName : worst10.find((a) => a.nation === "Wales")?.localAuthorityName ?? "at least one area on this list"}, far from London in every sense, sits on the same list.
          </p>
          <p>
            None of this means a specific restaurant in a lower-scoring area is unsafe, or that every business in a
            top-ranked area is spotless. Each area&apos;s average counts every FHRS-rated business equally, whatever
            its size or type, so it smooths out a lot of individual variation. A business that&apos;s had a poor
            inspection and is waiting for a re-visit can sit in the same borough as dozens of long-established
            5-rated regulars.
          </p>
          <p>
            If you&apos;re checking somewhere specific, use this ranking as a starting point, not a substitute. Every
            business on Should I Eat Here has its own page showing its current rating, the date of its latest
            inspection and its rating history where available — that&apos;s the figure that matters before you book a
            table or order in. Use the map above to explore ratings street by street, or search for a business or
            postcode.
          </p>
        </div>
      </div>

      <div id="detailed-findings" className="mt-10 scroll-mt-20">
        <h3 className="text-lg font-semibold text-gray-900">Detailed findings</h3>
        <details className="mt-3 rounded-xl border border-gray-200 bg-white">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-semibold text-indigo-600 select-none hover:bg-gray-50">
            Show the full detailed ranking — all {ranked.length} areas, with nation and rank-in-nation →
          </summary>
          <div className="border-t border-gray-100 px-4 py-4">
            <RankingTable areas={ranked} variant="detailed" />
          </div>
        </details>
        <p className="mt-2 text-xs text-gray-500">
          Overall rank uses the same tie-break as every other table on this page — see methodology below.
        </p>
      </div>
    </section>
  );
}
