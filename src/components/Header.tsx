import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l1.5 1.5 4.5-4.5M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
            </svg>
          </span>
          <span>
            UK Food Hygiene Ratings
          </span>
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
    </header>
  );
}
