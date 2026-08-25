import { ImageResponse } from "next/og";

// Same magnifying-glass + rating-star mark as the header logo (Header.tsx) and
// icon.svg — shared here so apple-icon.tsx and the PWA manifest icon routes render
// pixel-identical artwork at whatever size they need, instead of duplicating the SVG
// path data in three places.
const STAR_PATH = "M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z";

export function renderBrandIcon(pixelSize: number) {
  const iconSize = Math.round(pixelSize * 0.56);
  const radius = Math.round(pixelSize * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)",
          borderRadius: radius,
        }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <path
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z"
          />
          <path d={STAR_PATH} fill="#fbbf24" transform="translate(5.5,5.675) scale(0.35)" />
        </svg>
      </div>
    ),
    { width: pixelSize, height: pixelSize },
  );
}
