import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/establishments/business-types
 *
 * Returns the distinct (businessTypeId, businessType) pairs present among active
 * establishments, sorted alphabetically by name. Used to populate the business type
 * filter dropdown on the search page without hardcoding the FSA's business type list.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  try {
    const businessTypes = await prisma.establishment.findMany({
      where: { isActive: true },
      select: { businessTypeId: true, businessType: true },
      distinct: ["businessTypeId"],
      orderBy: { businessType: "asc" },
    });

    return NextResponse.json({ data: businessTypes });
  } catch (err) {
    console.error("GET /api/establishments/business-types failed:", err);
    return jsonError(500, "Internal server error while fetching business types.");
  }
}
