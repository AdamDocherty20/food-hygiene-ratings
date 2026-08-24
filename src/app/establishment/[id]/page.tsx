"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, fetchEstablishment } from "@/lib/api-client";
import { EstablishmentMap, type MapPoint } from "@/components/EstablishmentMap";
import { RatingBadge } from "@/components/RatingBadge";
import { formatAddress } from "@/lib/format";
import type { Establishment } from "@/lib/types";

type RequestState =
  | { fhrsId: string; status: "loading" }
  | { fhrsId: string; status: "success"; data: Establishment }
  | { fhrsId: string; status: "error"; message: string };

export default function EstablishmentDetailPage() {
  const params = useParams<{ id: string }>();
  const fhrsId = params.id;

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

  if (requestState.status === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-gray-500">Loading…</div>;
  }

  if (requestState.status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {requestState.message}
        </div>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
          &larr; Back to search
        </Link>
      </div>
    );
  }

  const establishment = requestState.data;

  const mapPoints: MapPoint[] =
    establishment.latitude !== null && establishment.longitude !== null
      ? [
          {
            id: establishment.id,
            lat: establishment.latitude,
            lng: establishment.longitude,
            label: establishment.businessName,
            href: `/establishment/${establishment.fhrsId}`,
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm font-medium text-blue-600 hover:underline">
        &larr; Back to search
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{establishment.businessName}</h1>
            <p className="mt-1 text-sm text-gray-600">{establishment.businessType}</p>
          </div>
          <RatingBadge
            schemeType={establishment.schemeType}
            ratingValue={establishment.ratingValue}
            ratingDate={establishment.ratingDate}
          />
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Address</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatAddress(establishment)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Local authority</dt>
            <dd className="mt-1 text-sm text-gray-900">{establishment.localAuthorityName}</dd>
          </div>
        </dl>
      </div>

      {mapPoints.length > 0 && (
        <div className="mt-6">
          <EstablishmentMap points={mapPoints} heightClassName="h-[350px]" />
        </div>
      )}
    </div>
  );
}
