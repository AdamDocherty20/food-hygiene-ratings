import Link from "next/link";
import type { AreaHygieneStats } from "@/lib/area-queries";

interface RankedAreaLike extends AreaHygieneStats {
  rank: number;
  rankInNation?: number;
  nation?: string | null;
}

interface RankingTableProps {
  areas: RankedAreaLike[];
  /** "simple" = rank + area only. "standard" = + avg/rated5/count. "detailed" = + nation. */
  variant?: "simple" | "standard" | "detailed";
}

// Reused for every ranking table on the page (top 10s, share-rated-5 extremes, the full
// list, the detailed findings table) so column styling can't drift between them.
export function RankingTable({ areas, variant = "standard" }: RankingTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
            <th className="py-2 pr-3 font-semibold">#</th>
            <th className="py-2 pr-3 font-semibold">Area</th>
            {variant === "detailed" && (
              <>
                <th className="py-2 pr-3 font-semibold">Nation</th>
                <th className="py-2 pr-3 font-semibold">Rank in nation</th>
              </>
            )}
            {variant !== "simple" && (
              <>
                <th className="py-2 pr-3 font-semibold">Avg rating</th>
                <th className="py-2 pr-3 font-semibold">Rated 5</th>
                <th className="py-2 font-semibold">Rated businesses</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area.localAuthorityName} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-3 text-sm text-gray-400 tabular-nums">{area.rank}</td>
              <td className="py-2 pr-3 text-sm font-medium text-gray-900">
                {area.slug ? (
                  <Link href={`/area/${area.slug}`} className="text-indigo-600 hover:underline">
                    {area.localAuthorityName}
                  </Link>
                ) : (
                  area.localAuthorityName
                )}
              </td>
              {variant === "detailed" && (
                <>
                  <td className="py-2 pr-3 text-sm text-gray-600">{area.nation ?? "—"}</td>
                  <td className="py-2 pr-3 text-sm text-gray-500 tabular-nums">{area.rankInNation || "—"}</td>
                </>
              )}
              {variant !== "simple" && (
                <>
                  <td className="py-2 pr-3 text-sm font-semibold text-gray-900 tabular-nums">{area.averageRating.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-sm text-gray-600 tabular-nums">{area.pctRated5}%</td>
                  <td className="py-2 text-sm text-gray-500 tabular-nums">{area.ratedCount.toLocaleString("en-GB")}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
