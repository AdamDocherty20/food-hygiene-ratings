import type { AreaHygieneStats } from "@/lib/area-queries";

export type CompareMetric = "pctRated5" | "averageRating" | "pctRated0To2";

export interface CompareMetricOption {
  value: CompareMetric;
  label: string;
  /** Short form for the map marker, e.g. "68%" or "4.51". */
  format: (stats: AreaHygieneStats) => string;
  /** Full sentence for the popup/info panel. */
  describe: (stats: AreaHygieneStats) => string;
  /** Whether a *higher* number is the better outcome — averageRating and pctRated5 are;
   *  pctRated0To2 is inverted (a low percentage is the good outcome). Drives both the
   *  colour scale direction and the default sort order for any future ranked list. */
  higherIsBetter: boolean;
}

export const COMPARE_METRICS: CompareMetricOption[] = [
  {
    value: "pctRated5",
    label: "% rated 5",
    format: (s) => `${s.pctRated5}%`,
    describe: (s) => `${s.pctRated5}% of rated establishments scored a 5`,
    higherIsBetter: true,
  },
  {
    value: "averageRating",
    label: "Average hygiene rating",
    format: (s) => s.averageRating.toFixed(2),
    describe: (s) => `Average hygiene rating of ${s.averageRating.toFixed(2)} out of 5`,
    higherIsBetter: true,
  },
  {
    value: "pctRated0To2",
    label: "% rated 0-2",
    format: (s) => `${s.pctRated0To2}%`,
    describe: (s) => `${s.pctRated0To2}% of rated establishments scored 0-2`,
    higherIsBetter: false,
  },
];

export function getCompareMetric(value: string): CompareMetricOption {
  return COMPARE_METRICS.find((m) => m.value === value) ?? COMPARE_METRICS[0];
}

// Maps a stat's metric value to a red→green hue (0 = red, 120 = green) based on where it
// falls between the *current result set's* min and max — not a fixed scale — so the
// colours stay meaningfully spread out regardless of which metric is selected or how
// tightly UK local authorities happen to cluster on it. Direction flips for
// "lower is better" metrics (pctRated0To2) so red always means "worse" to the eye.
export function buildColorScale(
  stats: AreaHygieneStats[],
  metric: CompareMetricOption,
): (stats: AreaHygieneStats) => string {
  const values = stats.map((s) => s[metric.value] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (s) => {
    const raw = ((s[metric.value] as number) - min) / range;
    const normalized = metric.higherIsBetter ? raw : 1 - raw;
    const hue = Math.round(normalized * 120); // 0 = red, 120 = green
    return `hsl(${hue}, 65%, 40%)`;
  };
}
