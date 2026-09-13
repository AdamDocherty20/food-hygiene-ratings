"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// A compact, always-visible search entry point in the header — the homepage's own hero
// search form (name/postcode/business type, see SearchPageContent.tsx) only exists on "/",
// so every other page (an establishment, an area, this establishment's claim form) had no
// way to search at all without navigating back to the homepage first. This is deliberately
// a single keyword field, not the full form — matches the relationship Tripadvisor/
// SquareMeal/TheFork all have between a small persistent nav search and a bigger hero one.
export function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/?name=${encodeURIComponent(trimmed)}` : "/");
  }

  return (
    <form onSubmit={handleSubmit} className="hidden sm:block sm:w-56 md:w-72">
      <label htmlFor="header-search" className="sr-only">
        Search restaurants, takeaways, and more
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          id="header-search"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search restaurants..."
          className="w-full rounded-full border border-gray-300 bg-gray-50 py-1.5 pr-3 pl-8 text-sm focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>
    </form>
  );
}

// Mobile equivalent of HeaderSearch above — there's no room for a full input next to the
// logo + Saved + FSA link at narrow widths, so this is just an icon button that jumps
// straight to the homepage hero's full search form instead of duplicating a second input.
export function HeaderSearchButton() {
  return (
    <Link
      href="/"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-indigo-600 sm:hidden"
      aria-label="Search"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
      </svg>
    </Link>
  );
}
