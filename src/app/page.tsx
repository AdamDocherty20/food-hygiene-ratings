import { Suspense } from "react";
import { SearchPageContent } from "@/components/search/SearchPageContent";

export default function Home() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">Loading…</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
