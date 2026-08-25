"use client";

import dynamic from "next/dynamic";
import type { MapPoint, SearchThisAreaQuery } from "@/components/EstablishmentMapInner";

interface EstablishmentMapProps {
  points: MapPoint[];
  heightClassName?: string;
  onSearchThisArea?: (query: SearchThisAreaQuery) => void;
}

const DEFAULT_HEIGHT_CLASSNAME = "h-[500px]";

// Leaflet touches `window` as soon as it's imported, which breaks server-side
// rendering — load the actual map only in the browser.
const EstablishmentMapInner = dynamic(() => import("@/components/EstablishmentMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className={`flex w-full ${DEFAULT_HEIGHT_CLASSNAME} items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-500 shadow-sm`}
    >
      Loading map…
    </div>
  ),
});

export function EstablishmentMap({
  points,
  heightClassName = DEFAULT_HEIGHT_CLASSNAME,
  onSearchThisArea,
}: EstablishmentMapProps) {
  return <EstablishmentMapInner points={points} heightClassName={heightClassName} onSearchThisArea={onSearchThisArea} />;
}

export type { MapPoint, SearchThisAreaQuery };
