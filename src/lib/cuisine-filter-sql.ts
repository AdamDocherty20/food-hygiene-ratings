import { Prisma } from "@/generated/prisma/client";
import type { Cuisine } from "@/lib/cuisines";

// Server-only: builds the EXISTS(...) fragment against OsmMatch for a given cuisine, for
// use inside a raw $queryRaw WHERE clause selecting from "Establishment" (unaliased) — see
// the "cuisine" filter in /api/establishments/search, /nearby, and /nearby/map. Not
// expressible via Prisma's typed query builder since fhrsId is a loose cross-table
// reference, not a declared relation (same reasoning as the other match tables — see
// OsmMatch's own comment in schema.prisma).
//
// Kept out of cuisines.ts (which is also imported client-side for the cuisine tile list)
// so the Prisma Client import here never ends up in the browser bundle.
export function cuisineFilterSql(cuisine: Cuisine): Prisma.Sql {
  const condition =
    cuisine.match.field === "cuisine"
      ? Prisma.sql`"cuisine" ILIKE ${`%${cuisine.match.value}%`}`
      : Prisma.sql`${Prisma.raw(`"${cuisine.match.field}"`)} = 'yes'`;

  return Prisma.sql`EXISTS (
    SELECT 1 FROM "OsmMatch"
    WHERE "OsmMatch"."fhrsId" = "Establishment"."fhrsId" AND ${condition}
  )`;
}
