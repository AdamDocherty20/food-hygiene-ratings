"use client";

import dynamic from "next/dynamic";

interface CompareAreasMapProps {
  metric: string;
  heightClassName?: string;
}

const DEFAULT_HEIGHT_CLASSNAME = "h-[560px]";

const CompareAreasMapInner = dynamic(() => import("@/components/foodHygieneMap/CompareAreasMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className={`flex w-full ${DEFAULT_HEIGHT_CLASSNAME} items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-500 shadow-sm`}
    >
      Loading map…
    </div>
  ),
});

export function CompareAreasMap({ metric, heightClassName = DEFAULT_HEIGHT_CLASSNAME }: CompareAreasMapProps) {
  return <CompareAreasMapInner metric={metric} heightClassName={heightClassName} />;
}
