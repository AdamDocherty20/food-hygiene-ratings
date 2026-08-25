import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPageContent } from "@/components/search/SearchPageContent";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// The search UI lives at "/" with all its filters as query params (?name=, ?postcode=,
// ?businessTypeId=, ?sort=, etc). Without a fixed canonical, every filter combination a
// crawler follows here (e.g. from an /area page's "See all in search" link) would be
// indexable as its own URL, diluting the homepage's ranking signal. Search result pages
// aren't meant to rank on their own anyway — that's what /area is for — so every variant
// canonicalizes back to the bare homepage.
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
};

export default function Home() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-500">Loading…</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
