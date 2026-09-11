"use client";

import { useEffect, useState } from "react";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import type { EstablishmentSummary, FsaDetail } from "@/lib/types";

// The FHRS component score breakdown, fetched live from the FSA (not in the bulk feed
// scripts/sync.ts imports, so it isn't in our own database). Counterintuitively, lower is
// better on all three — 0 is the best possible score — and each measure has its own max
// (these are the FSA's fixed scoring bands, not something this app invents). Shown as
// "value / max" with a low-fill bar, rather than a bare number, specifically so a "5" here
// doesn't get misread as "5 out of 5" the way the star rating elsewhere on the page does —
// on a 0-25 scale, 5 is actually one of the best possible scores.
const SCORE_MAX = {
  hygiene: 25,
  structural: 20,
  confidenceInManagement: 30,
} as const;

function ScoreBreakdown({ scores }: { scores: NonNullable<FsaDetail["scores"]> }) {
  const rows: { label: string; value: number; max: number }[] = [
    { label: "Hygienic food handling", value: scores.hygiene, max: SCORE_MAX.hygiene },
    { label: "Cleanliness of facilities", value: scores.structural, max: SCORE_MAX.structural },
    { label: "Confidence in management", value: scores.confidenceInManagement, max: SCORE_MAX.confidenceInManagement },
  ];

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Inspection score breakdown</h2>
      <p className="mt-1 text-xs text-gray-500">
        These are separate from the 0-5 star rating above — <strong>lower is better</strong> here, with 0 the
        best possible score on each measure.
      </p>
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-gray-600">{row.label}</dt>
              <dd className="font-medium text-gray-900">
                {row.value} <span className="text-gray-400">/ {row.max}</span>
              </dd>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-indigo-400"
                style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

// FSA-supplied extras that aren't in our own database: the business's written response to
// its inspection (if any) and a phone number. Renders nothing for whichever fields are
// missing, and the whole section is skipped by the caller if fsaDetail is null altogether
// (e.g. the FSA's live API timed out).
function FsaExtrasSection({ fsaDetail }: { fsaDetail: FsaDetail }) {
  if (!fsaDetail.phone && !fsaDetail.rightToReply && !fsaDetail.scores) return null;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {(fsaDetail.phone || fsaDetail.rightToReply) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {fsaDetail.phone && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Phone</h2>
              <a href={`tel:${fsaDetail.phone}`} className="mt-1 inline-block text-sm text-indigo-600 hover:underline">
                {fsaDetail.phone}
              </a>
            </div>
          )}
          {fsaDetail.phone && fsaDetail.rightToReply && <hr className="my-4 border-gray-100" />}
          {fsaDetail.rightToReply && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Business&apos;s response</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{fsaDetail.rightToReply}</p>
            </div>
          )}
        </div>
      )}
      {fsaDetail.scores && <ScoreBreakdown scores={fsaDetail.scores} />}
    </div>
  );
}

// A heads-up that a re-inspection has already taken place but the FSA hasn't published the
// new rating yet — the rating shown on the page is the last published one, not necessarily
// the current one.
function NewRatingPendingBanner() {
  return (
    <p className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      A new inspection has taken place — this rating may be out of date until the FSA publishes the result.
    </p>
  );
}

/**
 * Everything about the establishment page that either needs the browser (recently-viewed
 * tracking) or depends on a live, occasionally-slow call to the FSA's own API (phone,
 * right-to-reply, score breakdown, new-rating-pending) rather than our own database — see
 * EstablishmentDetailHero for the server-rendered core content. Rendering nothing while
 * this loads (or if it fails) is intentional: none of this is essential, so there's no
 * skeleton/error state, it just appears if and when it arrives.
 */
export function EstablishmentClientExtras({ fhrsId, summary }: { fhrsId: number; summary: EstablishmentSummary }) {
  const [fsaDetail, setFsaDetail] = useState<FsaDetail | null>(null);

  useEffect(() => {
    recordRecentlyViewed(summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.fhrsId]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/establishments/${fhrsId}/fsa`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { fsaDetail: FsaDetail | null } | null) => {
        if (!cancelled && body?.fsaDetail) setFsaDetail(body.fsaDetail);
      })
      .catch(() => {
        // Non-essential enrichment — silently show nothing, same as a null response.
      });

    return () => {
      cancelled = true;
    };
  }, [fhrsId]);

  if (!fsaDetail) return null;

  return (
    <>
      {fsaDetail.newRatingPending && <NewRatingPendingBanner />}
      <FsaExtrasSection fsaDetail={fsaDetail} />
    </>
  );
}
