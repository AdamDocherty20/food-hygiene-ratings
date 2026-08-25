"use client";

import { useSyncExternalStore } from "react";
import { getSavedEstablishments, subscribeToSavedEstablishments, type SavedEstablishment } from "@/lib/saved-establishments";

const EMPTY: SavedEstablishment[] = [];

// useSyncExternalStore (rather than useState + useEffect) so every component reading the
// saved list — the save/unsave button, the /saved page, a future header count — re-renders
// in sync the instant any one of them writes to localStorage, without prop drilling.
export function useSavedEstablishments(): SavedEstablishment[] {
  return useSyncExternalStore(subscribeToSavedEstablishments, getSavedEstablishments, () => EMPTY);
}
