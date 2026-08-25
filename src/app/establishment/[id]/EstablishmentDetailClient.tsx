"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, fetchEstablishment } from "@/lib/api-client";
import { EstablishmentMap, type MapPoint } from "@/components/EstablishmentMap";
import { NearbyEstablishments } from "@/components/NearbyEstablishments";
import { RatingBadge } from "@/components/RatingBadge";
import { ShareButton } from "@/components/ShareButton";
import { formatAddress, humanizeStatus } from "@/lib/format";
import { establishmentPath, parseFhrsIdParam } from "@/lib/slug";
import type { Establishment } from "@/lib/types";

type RequestState =
  | { fhrsId: string; status: "loading" }
  | { fhrsId: string; status: "success"; data: Establishment }
  | { fhrsId: string; status: "error"; message: string };

const NUMERIC_FHRS_VALUES = new Set(["0", "1", "2", "3", "4", "5"]);

// A left-edge accent stripe on the hero card, echoing the same red/amber/green
// categorisation as RatingBadge — a quick at-a-glance cue before you've even read the
// badge text.
function ratingAccentClasses(schemeType: string, ratingValue: string): string {
  if (schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(ratingValue)) {
    const numeric = Number(ratingValue);
    if (numeric <= 1) return "border-l-red-400";
    if (numeric <= 3) return "border-l-amber-400";
    return "border-l-green-400";
  }
  if (schemeType === "FHIS") {
    const normalized = ratingValue.toLowerCase();
    if (normalized === "pass") return "border-l-green-400";
    if (normalized === "improvement required") return "border-l-amber-400";
  }
  return "border-l-gray-300";
}

function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to search
    </Link>
  );
}

export function EstablishmentDetailClient() {
  const router = useRouter();
  // The route segment is "[fhrsId]-[slug]" (e.g. "1954128-nosh") or, for old links, just
  // the bare fhrsId — the slug is cosmetic, so only the leading digits are ever used to
  // look the establishment up.
  const params = useParams<{ id: string }>();
  const fhrsId = parseFhrsIdParam(params.id);

  // As with the search page, request state is derived during render (rather than reset
  // via a synchronous setState at the top of the effect) whenever the route's fhrsId
  // changes — the effect itself only calls setState from within its async callbacks.
  const [requestState, setRequestState] = useState<RequestState>({ fhrsId, status: "loading" });
  if (requestState.fhrsId !== fhrsId) {
    setRequestState({ fhrsId, status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;

    fetchEstablishment(fhrsId)
      .then((data) => {
        if (!cancelled) setRequestState({ fhrsId, status: "success", data });
      })
      .catch((err) => {
        if (cancelled) return;
        setRequestState({
          fhrsId,
          status: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Something went wrong while loading this establishment. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fhrsId]);

  // Once the business name is known, silently correct the URL to the canonical
  // "id-slug" form — this upgrades old bare-ID bookmarks/links and self-heals a stale
  // slug after a business renames, without ever blocking the page on it.
  useEffect(() => {
    if (requestState.status !== "success") return;
    const canonicalPath = establishmentPath(requestState.data.fhrsId, requestState.data.businessName);
    if (window.location.pathname !== canonicalPath) {
      router.replace(canonicalPath);
    }
  }, [requestState, router]);

  if (requestState.status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <div className="mt-6 animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-6 w-2/3 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-1/3 rounded bg-gray-100" />
          <div className="mt-6 h-20 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (requestState.status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {requestState.message}
        </div>
      </div>
    );
  }

  const establishment = requestState.data;

  const isNumericFhrs = establishment.schemeType === "FHRS" && NUMERIC_FHRS_VALUES.has(establishment.ratingValue);
  const shareText = `${establishment.businessName} — food hygiene rating: ${
    isNumericFhrs ? `${establishment.ratingValue}/5` : humanizeStatus(establishment.ratingValue)
  }`;

  const mapPoints: MapPoint[] =
    establishment.latitude !== null && establishment.longitude !== null
      ? [
          {
            id: establishment.id,
            lat: establishment.latitude,
            lng: establishment.longitude,
            label: establishment.businessName,
            href: establishmentPath(establishment.fhrsId, establishment.businessName),
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <BackLink />
        <ShareButton title={establishment.businessName} text={shareText} />
      </div>

      <div
        className={`mt-4 rounded-xl border border-l-4 border-gray-200 bg-white p-6 shadow-sm ${ratingAccentClasses(establishment.schemeType, establishment.ratingValue)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{establishment.businessName}</h1>
            <span className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {establishment.businessType}
            </span>
          </div>
          <RatingBadge
            schemeType={establishment.schemeType}
            ratingValue={establishment.ratingValue}
            ratingDate={establishment.ratingDate}
            size="lg"
          />
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 sm:grid-cols-2">
          <InfoRow label="Address" value={formatAddress(establishment)} />
          <InfoRow label="Local authority" value={establishment.localAuthorityName} />
        </dl>
      </div>

      {mapPoints.length > 0 && (
        <div className="mt-6">
          <EstablishmentMap points={mapPoints} heightClassName="h-[350px]" />
        </div>
      )}

      {establishment.latitude !== null && establishment.longitude !== null && (
        <NearbyEstablishments
          fhrsId={establishment.fhrsId}
          lat={establishment.latitude}
          lng={establishment.longitude}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
