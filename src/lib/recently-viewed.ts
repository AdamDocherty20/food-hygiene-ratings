import type { EstablishmentSummary } from "@/lib/types";

// A client-only "recently viewed" trail, persisted to localStorage — recorded whenever an
// establishment detail page loads, and shown as a strip on the homepage so a visitor who
// closed the tab or navigated away can jump straight back in. Capped at MAX_ENTRIES,
// newest first; re-viewing an establishment moves it back to the front rather than adding
// a duplicate.

const STORAGE_KEY = "shouldieathere:recently-viewed";
const CHANGE_EVENT = "shouldieathere:recently-viewed-changed";
const MAX_ENTRIES = 8;

export interface RecentlyViewedEstablishment extends EstablishmentSummary {
  viewedAt: string;
}

// See saved-establishments.ts for why this is cached rather than re-read/re-parsed on
// every call — it keeps the array reference stable for useSyncExternalStore.
let cache: RecentlyViewedEstablishment[] | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) cache = null;
  });
}

function readAll(): RecentlyViewedEstablishment[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }

  return cache;
}

function writeAll(entries: RecentlyViewedEstablishment[]): void {
  cache = entries;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Most recently viewed first. */
export function getRecentlyViewed(): RecentlyViewedEstablishment[] {
  return readAll();
}

export function recordRecentlyViewed(establishment: EstablishmentSummary): void {
  const existing = readAll().filter((entry) => entry.fhrsId !== establishment.fhrsId);
  writeAll([{ ...establishment, viewedAt: new Date().toISOString() }, ...existing].slice(0, MAX_ENTRIES));
}

export function subscribeToRecentlyViewed(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
