import Link from "next/link";

// The same 20x20 star used in RatingBadge's star rows — reused here so the logo reads as
// "the rating star, found via search", tying the mark directly to what the site does.
const STAR_PATH =
  "M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z";

function BrandMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z"
        />
        <path d={STAR_PATH} fill="#fbbf24" transform="translate(5.5,5.675) scale(0.35)" />
      </svg>
    </span>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
          <BrandMark />
          <span>Should I Eat Here</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/saved"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
            </svg>
            Saved
          </Link>
          <a
            href="https://ratings.food.gov.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600 sm:inline-flex sm:items-center sm:gap-1"
          >
            Official FSA site
            <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}
