import type { MetadataRoute } from "next";

// Lets mobile browsers offer "Add to Home Screen" / install the site as a lightweight
// PWA. Icons are generated PNG routes (icon-192, icon-512) rendering the same
// magnifying-glass + rating-star mark used everywhere else in the app (see brand-icon.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Should I Eat Here — UK Food Hygiene Ratings",
    short_name: "Should I Eat Here",
    description:
      "Search official Food Standards Agency food hygiene ratings (FHRS/FHIS) for restaurants, takeaways, cafes, shops and more across the UK.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
