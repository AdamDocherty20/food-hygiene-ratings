"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A persistent bottom search bar for mobile — the header's own search (see HeaderSearch)
// is a small icon button at that width, easy to miss/forget once you've scrolled a few
// screens down an establishment or area page. Hidden on the homepage itself (the hero
// search is already front-and-centre there) and on /admin (a staff tool, not a visitor
// page) rather than shown unconditionally everywhere.
export function StickyMobileCta() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
      <Link
        href="/"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
        Search hygiene ratings
      </Link>
    </div>
  );
}
