"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

// Catches unexpected runtime errors anywhere under the root layout (Header/Footer keep
// rendering, since error.tsx only replaces the segment below it) and offers a retry.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm font-semibold text-red-600">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
        We hit a snag loading this page
      </h1>
      <p className="mt-3 text-sm text-gray-600">
        Please try again — if the problem persists, head back to the homepage and search again.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Back to search
        </Link>
      </div>
    </div>
  );
}
