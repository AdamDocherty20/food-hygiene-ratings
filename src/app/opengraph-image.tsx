import { ImageResponse } from "next/og";

export const alt = "Should I Eat Here — UK food hygiene ratings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The default share-preview image for the site (used by the homepage and any page that
// doesn't define its own opengraph-image, e.g. establishment pages override this with
// one showing the specific business). Rendered at request time via Satori (next/og),
// which only understands inline styles/flexbox — no Tailwind classes here.
export default function Image() {
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 100,
            height: 100,
            borderRadius: 24,
            background: "rgba(255,255,255,0.15)",
            fontSize: 56,
            marginBottom: 44,
          }}
        >
          🔍
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>Should I Eat Here</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: "rgba(255,255,255,0.85)" }}>
          UK food hygiene ratings, at a glance
        </div>
      </div>
    ),
    { ...size },
  );
}
