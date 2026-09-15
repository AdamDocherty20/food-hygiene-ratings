import { NextResponse } from "next/server";
import { getAreaHygieneStats } from "@/lib/area-queries";

// Not viewport-driven like /api/establishments/map-clusters — Compare Areas shows every
// qualifying local authority at once (a few hundred rows, tiny payload), so there's no
// bounding-box param here. The underlying query groups the *entire* Establishment table
// (~1.6s, measured against the real dataset) rather than a narrow bbox slice, so this
// route deliberately relies on `revalidate` instead of the usual per-IP rate limiter:
// the two are in tension (reading request headers for the caller's IP forces the route
// dynamic, defeating this cache) and ratings only change on the once-daily FSA sync
// anyway, so an hour-old response is never meaningfully stale.
export const revalidate = 3600;

export async function GET() {
  try {
    const stats = await getAreaHygieneStats();
    return NextResponse.json({ data: stats });
  } catch (err) {
    console.error("GET /api/local-authorities/hygiene-stats failed:", err);
    return NextResponse.json({ error: "Internal server error while fetching area statistics." }, { status: 500 });
  }
}
