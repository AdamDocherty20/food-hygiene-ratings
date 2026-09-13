import { createHash, timingSafeEqual } from "node:crypto";

// Single shared password (ADMIN_PASSWORD env var), not real accounts — this app has
// exactly one operator, so a full auth system (users table, sessions, hashing per-user)
// would be pure overhead. The cookie never holds the plaintext password, just a hash of
// it, so it's no worse than a typical "remember me" session token if it ever leaked.
export const ADMIN_COOKIE_NAME = "admin_session";

export function getExpectedAdminToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash("sha256").update(password).digest("hex");
}

export function isValidAdminToken(token: string | undefined | null): boolean {
  const expected = getExpectedAdminToken();
  if (!expected || !token) return false;
  // Constant-time comparison — a plain === would let an attacker time their way to the
  // token byte-by-byte, the same reasoning as comparing any other secret.
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
