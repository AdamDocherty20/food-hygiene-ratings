import Link from "next/link";

/**
 * Prev/Next links for the paginated area & area/category pages — real <a href> links
 * (not a client-side control) so crawlers can walk the full chain from page 1 down to
 * every establishment in an area, not just the top 24 that fit on the first page.
 */
export function AreaPagination({ basePath, page, totalPages }: { basePath: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const hrefFor = (targetPage: number) => (targetPage <= 1 ? basePath : `${basePath}?page=${targetPage}`);

  return (
    <nav className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="font-medium text-indigo-600 hover:underline">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-gray-500">
        Page {page.toLocaleString("en-GB")} of {totalPages.toLocaleString("en-GB")}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="font-medium text-indigo-600 hover:underline">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
