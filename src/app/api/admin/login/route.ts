import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import { ADMIN_COOKIE_NAME, getExpectedAdminToken } from "@/lib/admin-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

const LoginSchema = z.object({ password: z.string().min(1) });

// Excluded from proxy.ts's own auth check (obviously — this is how you get the cookie in
// the first place). Rate-limited the same as every public mutation route, which also
// bounds password-guessing attempts without a dedicated lockout mechanism.
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Password is required.");

  const expected = getExpectedAdminToken();
  if (!expected) {
    return jsonError(500, "Admin login isn't configured (ADMIN_PASSWORD is unset).");
  }

  if (parsed.data.password !== process.env.ADMIN_PASSWORD) {
    return jsonError(401, "Incorrect password.");
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days — re-entering a password every session isn't worth the friction for a single trusted operator
  });
  return response;
}
