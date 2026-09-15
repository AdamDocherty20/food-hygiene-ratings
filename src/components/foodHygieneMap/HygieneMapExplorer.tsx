"use client";

import dynamic from "next/dynamic";
import type { FlyToTarget, HygieneMapFilters } from "@/components/foodHygieneMap/HygieneMapExplorerInner";
import type { MapEstablishmentPoint } from "@/lib/map-types";

interface HygieneMapExplorerProps {
  filters: HygieneMapFilters;
  flyTo: FlyToTarget | null;
  onFlyToHandled: () => void;
  onEstablishmentClick?: (point: MapEstablishmentPoint) => void;
  onReportClick?: (point: MapEstablishmentPoint) => void;
  heightClassName?: string;
}

const DEFAULT_HEIGHT_CLASSNAME = "h-[560px]";

// Leaflet touches `window` as soon as it's imported, which breaks server-side rendering —
// same reasoning (and pattern) as EstablishmentMap.tsx's own dynamic-import wrapper.
const HygieneMapExplorerInner = dynamic(() => import("@/components/foodHygieneMap/HygieneMapExplorerInner"), {
  ssr: false,
  loading: () => (
    <div
      className={`flex w-full ${DEFAULT_HEIGHT_CLASSNAME} items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-500 shadow-sm`}
    >
      Loading map…
    </div>
  ),
});

export function HygieneMapExplorer({ heightClassName = DEFAULT_HEIGHT_CLASSNAME, ...props }: HygieneMapExplorerProps) {
  return <HygieneMapExplorerInner heightClassName={heightClassName} {...props} />;
}

export type { FlyToTarget, HygieneMapFilters };
