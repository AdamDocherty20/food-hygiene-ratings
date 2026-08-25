"use client";

import Link from "next/link";
import { useSavedEstablishments } from "@/hooks/useSavedEstablishments";
import { RatingBadge } from "@/components/RatingBadge";
import { unsaveEstablishment } from "@/lib/saved-establishments";
import { establishmentPath } from "@/lib/slug";

export function SavedPageClient() {
  const saved = useSavedEstablishments();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Saved establishments</h1>
      <p className="mt-2 text-sm text-gray-500">
        Bookmarked from this browser — stored on your device only, not synced to an account.
      </p>

      {saved.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-gray-700">Nothing saved yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Tap &ldquo;Save&rdquo; on any establishment&apos;s page to bookmark it here.
            </p>
          </div>
          <Link href="/" className="mt-2 text-sm font-medium text-indigo-600 hover:underline">
            Search establishments
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {saved.map((entry) => (
            <li
              key={entry.fhrsId}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <Link href={establishmentPath(entry.fhrsId, entry.businessName)} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">{entry.businessName}</p>
                <p className="mt-0.5 text-sm text-gray-500">{entry.businessType}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {[entry.addressLine1, entry.postcode].filter(Boolean).join(", ") || "Address not available"}
                </p>
              </Link>
              <div className="flex flex-col items-end gap-2">
                <RatingBadge schemeType={entry.schemeType} ratingValue={entry.ratingValue} ratingDate={entry.ratingDate} />
                <button
                  type="button"
                  onClick={() => unsaveEstablishment(entry.fhrsId)}
                  className="text-xs font-medium text-gray-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
