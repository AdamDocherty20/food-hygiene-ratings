import { NextResponse } from "next/server";

/**
 * Standard JSON error shape returned by every API route: `{ "error": "..." }`.
 * Used for both client errors (400/404) and unexpected server errors (500), so
 * callers never have to deal with an unhandled crash / non-JSON response.
 */
export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}
