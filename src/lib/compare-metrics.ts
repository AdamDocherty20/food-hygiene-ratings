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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Default palette: a red→green hue sweep at fixed lightness. Reads intuitively for most
// visitors (red traffic-light "bad", green "good") but is close to worst-case for red-green
// colour blindness (protanopia/deuteranopia, ~8% of men) since hue is the only channel that
// varies — two areas at opposite ends of the scale can end up looking almost identical.
function redGreenColor(normalized: number): string {
  const hue = Math.round(normalized * 120); // 0 = red, 120 = green
  return `hsl(${hue}, 65%, 40%)`;
}

// Colourblind-safe alternative: dark blue (worse) to bright amber (better). Blue vs. orange
// sits on the blue-yellow axis rather than red-green, so it stays distinguishable under
// protanopia and deuteranopia, and lightness rises alongside the value too (blue is dark,
// amber is bright) so the scale still reads correctly even in plain greyscale, which covers
// the rarer case of near-total colour blindness as well.
const CB_LOW: [number, number, number] = [8, 48, 107];
const CB_HIGH: [number, number, number] = [230, 138, 8];
function colorblindColor(normalized: number): string {
  const r = lerp(CB_LOW[0], CB_HIGH[0], normalized);
  const g = lerp(CB_LOW[1], CB_HIGH[1], normalized);
  const b = lerp(CB_LOW[2], CB_HIGH[2], normalized);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** `normalized` is 0 (worst) to 1 (best) — shared by buildColorScale and the map legend so
 *  the two can never fall out of sync with each other. */
export function getScaleColor(normalized: number, colorblindMode: boolean): string {
  const clamped = Math.min(1, Math.max(0, normalized));
  return colorblindMode ? colorblindColor(clamped) : redGreenColor(clamped);
}

/** CSS `linear-gradient(...)` for the legend swatch. Sampled at several points rather than
 *  just the two endpoints — a plain 2-stop CSS gradient interpolates in RGB space, which
 *  would turn the default red→green scale a muddy brown in the middle instead of passing
 *  through yellow the way the actual per-area hue sweep does. */
export function getScaleGradientCss(colorblindMode: boolean, stops = 5): string {
  const colors = Array.from({ length: stops }, (_, i) => getScaleColor(i / (stops - 1), colorblindMode));
  return `linear-gradient(to right, ${colors.join(", ")})`;
}

// Maps a stat's metric value to a colour based on where it falls between the *current
// result set's* min and max — not a fixed scale — so the colours stay meaningfully spread
// out regardless of which metric is selected or how tightly UK local authorities happen to
// cluster on it. Direction flips for "lower is better" metrics (pctRated0To2) so the "worse"
// end of the palette always means worse to the eye.
export function buildColorScale(
  stats: AreaHygieneStats[],
  metric: CompareMetricOption,
  colorblindMode = false,
): (stats: AreaHygieneStats) => string {
  const values = stats.map((s) => s[metric.value] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (s) => {
    const raw = ((s[metric.value] as number) - min) / range;
    const normalized = metric.higherIsBetter ? raw : 1 - raw;
    return getScaleColor(normalized, colorblindMode);
  };
}
