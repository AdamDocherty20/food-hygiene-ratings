"use client";

import { useSavedEstablishments } from "@/hooks/useSavedEstablishments";
import { saveEstablishment, unsaveEstablishment } from "@/lib/saved-establishments";
import type { EstablishmentSummary } from "@/lib/types";

interface SaveButtonProps {
  establishment: EstablishmentSummary;
}

// Bookmarks an establishment to the browser's localStorage "saved" list (see
// src/lib/saved-establishments.ts) — no account system in this app, so this is per-browser
// rather than synced. Toggles between outline and filled bookmark icons to reflect state.
export function SaveButton({ establishment }: SaveButtonProps) {
  const saved = useSavedEstablishments();
  const isSaved = saved.some((entry) => entry.fhrsId === establishment.fhrsId);

  function handleClick() {
    if (isSaved) {
      unsaveEstablishment(establishment.fhrsId);
    } else {
      saveEstablishment(establishment);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isSaved}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        isSaved
          ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <svg
        className="h-4 w-4"
        fill={isSaved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
      </svg>
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
