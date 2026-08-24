import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-response";

/**
 * Simple in-memory, fixed-window, per-IP rate limiter for the public API routes.
 *
 * Caveat: this only protects a single long-lived Node process (e.g. a traditional
 * server, or a container/VM host). On serverless platforms (Vercel functions, etc.)
 * each invocation may run in a fresh process with its own empty `buckets` map, so this
 * provides little protection there — a shared store (e.g. Upstash Redis) would be
 * needed for that to work correctly across instances. It's still worth keeping as a
 * baseline since it's free and helps on single-instance deployments.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

// Sweeps stale buckets periodically so the map doesn't grow unbounded over the life of
// the process. Runs opportunistically on incoming requests rather than on a timer.
function cleanupStaleBuckets(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

/**
 * Checks and records a request against the caller's fixed window, returning a JSON
 * 429 response (with a Retry-After header) if they're over the limit, or `null` if the
 * request is allowed and route handling should proceed normally.
 */
export function enforceRateLimit(request: NextRequest) {
  const now = Date.now();
  cleanupStaleBuckets(now);

  const key = getClientIp(request);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000));
    const response = jsonError(429, "Too many requests. Please slow down and try again shortly.");
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return response;
  }

  return null;
}
