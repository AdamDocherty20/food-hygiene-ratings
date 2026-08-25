import { renderBrandIcon } from "@/lib/brand-icon";

// 192x192 PNG referenced from manifest.ts's icons array — the size Android/Chrome uses
// for the home-screen icon when a visitor "installs" the site as a PWA. Forced static
// since the artwork never changes — otherwise plain Route Handlers default to dynamic.
export const dynamic = "force-static";

export function GET() {
  return renderBrandIcon(192);
}
