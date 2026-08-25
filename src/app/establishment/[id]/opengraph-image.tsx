import { ImageResponse } from "next/og";
import { humanizeStatus } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { parseFhrsIdParam } from "@/lib/slug";

export const alt = "Food hygiene rating";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

// Re-implements RatingBadge's colour logic with plain hex values — Satori (the renderer
// behind next/og) only understands inline styles, not Tailwind classNames, so the
// className-based helpers in RatingBadge can't be reused directly here.
function ratingColors(schemeType: string, ratingValue: string): { bg: string; fg: string } {
  if (schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(ratingValue)) {
    const numeric = Number(ratingValue);
    if (numeric <= 1) return { bg: "#fee2e2", fg: "#991b1b" };
    if (numeric <= 3) return { bg: "#fef3c7", fg: "#92400e" };
    return { bg: "#dcfce7", fg: "#166534" };
  }
  if (schemeType === "FHIS") {
    const normalized = ratingValue.toLowerCase();
    if (normalized === "pass") return { bg: "#dcfce7", fg: "#166534" };
    if (normalized === "improvement required") return { bg: "#fef3c7", fg: "#92400e" };
  }
  return { bg: "#f3f4f6", fg: "#374151" };
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));

  const establishment = Number.isInteger(fhrsId)
    ? await prisma.establishment.findFirst({
        where: { fhrsId, isActive: true },
        select: { businessName: true, businessType: true, ratingValue: true, schemeType: true, localAuthorityName: true },
      })
    : null;

  if (!establishment) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "80px",
            background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700 }}>Should I Eat Here</div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: "rgba(255,255,255,0.85)" }}>
            UK food hygiene ratings, at a glance
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(establishment.ratingValue);
  const badgeText = isNumericFhrs ? `Rating ${establishment.ratingValue}/5` : humanizeStatus(establishment.ratingValue);
  const { bg, fg } = ratingColors(establishment.schemeType, establishment.ratingValue);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
          Should I Eat Here
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
            {establishment.businessName}
          </div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 20, color: "rgba(255,255,255,0.85)" }}>
            {establishment.businessType} &middot; {establishment.localAuthorityName}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 32,
              fontWeight: 700,
              padding: "14px 32px",
              borderRadius: 9999,
              background: bg,
              color: fg,
            }}
          >
            {badgeText}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
