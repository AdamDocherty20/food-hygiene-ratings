"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, fetchBusinessTypes, searchEstablishments } from "@/lib/api-client";
import { EstablishmentMap, type MapPoint } from "@/components/EstablishmentMap";
import { RatingBadge } from "@/components/RatingBadge";
import { formatAddress } from "@/lib/format";
import type { BusinessType, Establishment, PaginationMeta } from "@/lib/types";

function establishmentHref(fhrsId: number): string {
  return `/establishment/${fhrsId}`;
}

function toMapPoints(results: Establishment[]): MapPoint[] {
  return results
    .filter((result): result is Establishment & { latitude: number; longitude: number } => result.latitude !== null && result.longitude !== null)
    .map((result) => ({
      id: result.id,
      lat: result.latitude,
      lng: result.longitude,
      label: result.businessName,
      href: establishmentHref(result.fhrsId),
    }));
}

// Normalizes the current URL search params into the exact query string that will be
// sent to the search API (defaulting page to 1), used both as the effect dependency
// and as a stable "request key" for deriving loading/success/error state.
function buildSearchKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString());
  if (!params.has("page")) params.set("page", "1");
  return params.toString();
}

type SearchRequestState =
  | { key: string; status: "loading" }
  | { key: string; status: "success"; data: Establishment[]; pagination: PaginationMeta }
  | { key: string; status: "error"; message: string };

export function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);

  // Form fields are seeded from the URL so the form reflects the active search
  // (and stays correct across back/forward navigation). Rather than syncing them via
  // an effect, we compare the URL's current query key against the key that produced
  // the current field values, and adjust state during render when they diverge — the
  // React-recommended pattern for "adjusting state when a prop changes" without
  // triggering an extra effect-driven render pass.
  const formSyncKey = searchParams.toString();
  const [syncedFormKey, setSyncedFormKey] = useState(formSyncKey);
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [postcode, setPostcode] = useState(searchParams.get("postcode") ?? "");
  const [businessTypeId, setBusinessTypeId] = useState(searchParams.get("businessTypeId") ?? "");
  if (syncedFormKey !== formSyncKey) {
    setSyncedFormKey(formSyncKey);
    setName(searchParams.get("name") ?? "");
    setPostcode(searchParams.get("postcode") ?? "");
    setBusinessTypeId(searchParams.get("businessTypeId") ?? "");
  }

  // Same "derive during render" approach for the search results themselves: as soon as
  // the URL's search key changes, the request state flips to "loading" for that new key
  // during render, and the effect below only ever calls setState from within its async
  // .then/.catch callbacks (never synchronously in the effect body).
  const searchKey = buildSearchKey(searchParams);
  const [requestState, setRequestState] = useState<SearchRequestState>({ key: searchKey, status: "loading" });
  if (requestState.key !== searchKey) {
    setRequestState({ key: searchKey, status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;

    searchEstablishments(new URLSearchParams(searchKey))
      .then((response) => {
        if (cancelled) return;
        setRequestState({ key: searchKey, status: "success", data: response.data, pagination: response.pagination });
      })
      .catch((err) => {
        if (cancelled) return;
        setRequestState({
          key: searchKey,
          status: "error",
          message: err instanceof ApiError ? err.message : "Something went wrong while searching. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [searchKey]);

  useEffect(() => {
    let cancelled = false;
    fetchBusinessTypes()
      .then((response) => {
        if (!cancelled) setBusinessTypes(response.data);
      })
      .catch(() => {
        // Non-critical: the dropdown just stays empty if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (name.trim()) params.set("name", name.trim());
    if (postcode.trim()) params.set("postcode", postcode.trim());
    if (businessTypeId) params.set("businessTypeId", businessTypeId);
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`/?${params.toString()}`);
  }

  const isLoading = requestState.status === "loading";
  const results = requestState.status === "success" ? requestState.data : [];
  const pagination = requestState.status === "success" ? requestState.pagination : null;
  const error = requestState.status === "error" ? requestState.message : null;
  const mapPoints = toMapPoints(results);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Search food hygiene ratings</h1>

      <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Business name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Old Bakery"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="postcode" className="text-sm font-medium text-gray-700">
            Postcode
          </label>
          <input
            id="postcode"
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="e.g. SW1A 1AA"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="businessTypeId" className="text-sm font-medium text-gray-700">
            Business type
          </label>
          <select
            id="businessTypeId"
            value={businessTypeId}
            onChange={(e) => setBusinessTypeId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All types</option>
            {businessTypes.map((type) => (
              <option key={type.businessTypeId} value={type.businessTypeId}>
                {type.businessType}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          {error && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-500">Loading results…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500">No establishments found. Try adjusting your search.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((result) => (
                <li key={result.id}>
                  <Link
                    href={establishmentHref(result.fhrsId)}
                    className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{result.businessName}</p>
                        <p className="text-sm text-gray-600">{formatAddress(result)}</p>
                      </div>
                      <RatingBadge
                        schemeType={result.schemeType}
                        ratingValue={result.ratingValue}
                        ratingDate={result.ratingDate}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} results)
              </span>
              <button
                type="button"
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <EstablishmentMap points={mapPoints} />
        </div>
      </div>
    </div>
  );
}
