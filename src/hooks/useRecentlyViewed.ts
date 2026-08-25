"use client";

import { useSyncExternalStore } from "react";
import { getRecentlyViewed, subscribeToRecentlyViewed, type RecentlyViewedEstablishment } from "@/lib/recently-viewed";

const EMPTY: RecentlyViewedEstablishment[] = [];

export function useRecentlyViewed(): RecentlyViewedEstablishment[] {
  return useSyncExternalStore(subscribeToRecentlyViewed, getRecentlyViewed, () => EMPTY);
}
