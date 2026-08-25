import type { Metadata } from "next";
import { SavedPageClient } from "./SavedPageClient";

// Not indexed: the content here is per-browser localStorage state, not a real page any
// two visitors (or even the same visitor on a different device) would see the same thing
// on — nothing useful for a search engine to crawl.
export const metadata: Metadata = {
  title: "Saved establishments | Should I Eat Here",
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return <SavedPageClient />;
}
