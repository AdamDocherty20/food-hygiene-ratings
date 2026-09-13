import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminToken } from "@/lib/admin-auth";

// Next.js 16 renamed middleware.ts to proxy.ts (functionality unchanged) — see
// node_modules/next/dist/docs/.../proxy.md, checked before writing this since AGENTS.md
// flags this as exactly the kind of thing that differs from a model's training data.
//
// Gates every /admin page and /api/admin route behind ADMIN_PASSWORD (see
// src/lib/admin-auth.ts) — this app has one operator, not real user accounts, so a single
// shared password is the whole auth model. /admin/login itself is excluded from the
// matcher below to avoid a redirect loop.
export function proxy(request: NextRequest) {
  // Excluded from the auth check itself (not just documentation) — the matcher below
  // still needs to include it so /admin/login continues to run through this function at
  // all, but the check must not redirect a request that's already headed to the login page.
  if (request.nextUrl.pathname === "/admin/login" || request.nextUrl.pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (isValidAdminToken(token)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
