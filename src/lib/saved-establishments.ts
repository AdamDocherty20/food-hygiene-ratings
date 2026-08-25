import type { EstablishmentSummary } from "@/lib/types";

// A client-only "favourites" list, persisted to localStorage rather than the database —
// this app has no user accounts, so bookmarking is per-browser. Each entry snapshots the
// rating info at save time so the /saved page can render without an extra API round trip
// per establishment; that snapshot may go stale if the establishment is re-rated later,
// which is why the /saved page links through to the live establishment page rather than
// treating the stored ratingValue as current.

const STORAGE_KEY = "shouldieathere:saved-establishments";
// Fired on this tab whenever the list changes — the native "storage" event only fires in
// *other* tabs, so components in the same tab (the save button, a header count, etc.)
// need their own signal to stay in sync with each other.
const CHANGE_EVENT = "shouldieathere:saved-establishments-changed";

export interface SavedEstablishment extends EstablishmentSummary {
  savedAt: string;
}

// Cached in-memory so repeated reads (e.g. every render via useSyncExternalStore) return
// the same array reference until the data actually changes — returning a fresh array on
// every call would make React think the store changes on every render.
let cache: SavedEstablishment[] | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) cache = null;
  });
}

function readAll(): SavedEstablishment[] {
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

function writeAll(entries: SavedEstablishment[]): void {
  cache = entries;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Most recently saved first. */
export function getSavedEstablishments(): SavedEstablishment[] {
  return readAll();
}

export function isEstablishmentSaved(fhrsId: number): boolean {
  return readAll().some((entry) => entry.fhrsId === fhrsId);
}

export function saveEstablishment(establishment: EstablishmentSummary): void {
  const existing = readAll().filter((entry) => entry.fhrsId !== establishment.fhrsId);
  writeAll([{ ...establishment, savedAt: new Date().toISOString() }, ...existing]);
}

export function unsaveEstablishment(fhrsId: number): void {
  writeAll(readAll().filter((entry) => entry.fhrsId !== fhrsId));
}

export function subscribeToSavedEstablishments(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
