import { renderBrandIcon } from "@/lib/brand-icon";

// 512x512 PNG referenced from manifest.ts's icons array — used for splash screens and
// higher-density home-screen icons when the site is installed as a PWA. Forced static
// since the artwork never changes — otherwise plain Route Handlers default to dynamic.
export const dynamic = "force-static";

export function GET() {
  return renderBrandIcon(512);
}
