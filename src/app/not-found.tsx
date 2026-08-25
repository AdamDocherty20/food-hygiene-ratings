import Link from "next/link";

// Rendered whenever a route calls notFound() (e.g. an invalid establishment id) or for any
// unmatched URL under the app. Kept inside the normal layout (Header/Footer still render)
// so it doesn't feel like a dead end.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Page not found</h1>
      <p className="mt-3 text-sm text-gray-600">
        We couldn&apos;t find what you were looking for. It may have been moved, or the link might be
        incorrect.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Back to search
      </Link>
    </div>
  );
}
