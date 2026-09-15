import Link from "next/link";
import type { AreaHygieneStats } from "@/lib/area-queries";

interface AreaRankingsProps {
  stats: AreaHygieneStats[];
  minSample: number;
  dataUpdatedAt: string | null;
}

function RankingRow({ rank, area }: { rank: number; area: AreaHygieneStats }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-3 text-sm text-gray-400 tabular-nums">{rank}</td>
      <td className="py-2 pr-3 text-sm font-medium text-gray-900">
        {area.slug ? (
          <Link href={`/area/${area.slug}`} className="text-indigo-600 hover:underline">
            {area.localAuthorityName}
          </Link>
        ) : (
          area.localAuthorityName
        )}
      </td>
      <td className="py-2 pr-3 text-sm font-semibold text-gray-900 tabular-nums">{area.averageRating.toFixed(2)}</td>
      <td className="py-2 pr-3 text-sm text-gray-600 tabular-nums">{area.pctRated5}%</td>
      <td className="py-2 text-sm text-gray-500 tabular-nums">{area.ratedCount.toLocaleString("en-GB")}</td>
    </tr>
  );
}

function RankingTable({ areas, startRank }: { areas: AreaHygieneStats[]; startRank: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
            <th className="py-2 pr-3 font-semibold">#</th>
            <th className="py-2 pr-3 font-semibold">Area</th>
            <th className="py-2 pr-3 font-semibold">Avg rating</th>
            <th className="py-2 pr-3 font-semibold">Rated 5</th>
            <th className="py-2 font-semibold">Rated establishments</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area, index) => (
            <RankingRow key={area.localAuthorityName} rank={startRank + index} area={area} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Written-out rankings alongside the interactive Compare Areas map — the map itself isn't
// crawlable or copy-pasteable, and a journalist citing "the UK's best/worst areas for food
// hygiene" needs a plain, linkable list of numbers they can quote or screenshot, not a
// piece of client-side JS. Server-rendered like the rest of this page, so it's in the
// initial HTML for both search engines and anyone just viewing source.
export function AreaRankings({ stats, minSample, dataUpdatedAt }: AreaRankingsProps) {
  const ranked = [...stats].sort((a, b) => b.averageRating - a.averageRating);
  const best10 = ranked.slice(0, 10);
  const worst10 = ranked.slice(-10).reverse();

  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="text-lg font-semibold text-gray-900">UK areas ranked by average food hygiene rating</h2>
      <p className="mt-2 max-w-3xl text-sm text-gray-600">
        Based on {ranked.length} UK local authorities with at least {minSample} numerically rated (FHRS 0-5) food
        businesses{dataUpdatedAt ? `, as of the most recent data sync on ${dataUpdatedAt}` : ""}. Scotland uses a
        separate scheme (FHIS) with no numeric score, so it isn&apos;t included in this ranking — see the methodology
        note below. Feel free to cite or link to this page.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-green-700 uppercase">Top 10 best-rated areas</h3>
          <div className="mt-3">
            <RankingTable areas={best10} startRank={1} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-red-700 uppercase">Top 10 worst-rated areas</h3>
          <div className="mt-3">
            <RankingTable areas={worst10} startRank={1} />
          </div>
        </div>
      </div>

      <details className="mt-8 rounded-xl border border-gray-200 bg-white">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-semibold text-indigo-600 select-none hover:bg-gray-50">
          Show the full ranking — all {ranked.length} areas →
        </summary>
        <div className="border-t border-gray-100 px-4 py-4">
          <RankingTable areas={ranked} startRank={1} />
        </div>
      </details>
    </section>
  );
}
