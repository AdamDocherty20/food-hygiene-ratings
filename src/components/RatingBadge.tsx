import { formatRatingDate, humanizeStatus } from "@/lib/format";

interface RatingBadgeProps {
  schemeType: string;
  ratingValue: string;
  ratingDate: string | null;
  /** "lg" is used on the establishment detail page hero; everywhere else stays compact. */
  size?: "sm" | "lg";
}

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

// Simple 0-5 colour scale for FHRS: red (0-1), amber (2-3), green (4-5).
function fhrsColourClasses(ratingValue: string): string {
  const numeric = Number(ratingValue);
  if (numeric <= 1) return "bg-red-100 text-red-800 border-red-300";
  if (numeric <= 3) return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-green-100 text-green-800 border-green-300";
}

// FHIS has no numeric scale, just a status — colour it loosely by favourability
// without pretending it's a 0-5 score.
function fhisColourClasses(ratingValue: string): string {
  const normalized = ratingValue.toLowerCase();
  if (normalized === "pass") return "bg-green-100 text-green-800 border-green-300";
  if (normalized === "improvement required") return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-gray-100 text-gray-700 border-gray-300";
}

const STAR_PATH =
  "M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z";

function Stars({ filled, size }: { filled: number; size: "sm" | "lg" }) {
  const starClass = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((position) => (
        <svg
          key={position}
          viewBox="0 0 20 19"
          className={`${starClass} ${position <= filled ? "fill-amber-400" : "fill-gray-200"}`}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}

/**
 * Renders a rating as a coloured badge, branching on schemeType, and always shows the
 * rating date alongside it — displaying the rating date next to every rating in the app
 * is an Open Government Licence attribution requirement, not just a nice-to-have, so
 * it's baked into this component rather than left to call sites to remember.
 */
export function RatingBadge({ schemeType, ratingValue, ratingDate, size = "sm" }: RatingBadgeProps) {
  const isFhrs = schemeType === "FHRS";
  const isNumericFhrs = isFhrs && NUMERIC_FHRS_VALUES.has(ratingValue);

  const badgeClasses = isNumericFhrs
    ? fhrsColourClasses(ratingValue)
    : isFhrs
      ? "bg-gray-100 text-gray-700 border-gray-300"
      : fhisColourClasses(ratingValue);

  const badgeText = isNumericFhrs ? `${ratingValue}/5` : humanizeStatus(ratingValue);
  const textSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {isNumericFhrs && <Stars filled={Number(ratingValue)} size={size} />}
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold ${textSize} ${badgeClasses}`}
      >
        {isNumericFhrs ? `Rating ${badgeText}` : badgeText}
      </span>
      <span className="text-xs text-gray-500">{formatRatingDate(ratingDate)}</span>
    </div>
  );
}
