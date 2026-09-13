"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson } from "@/lib/api-client";
import { establishmentPath } from "@/lib/slug";

const RELATIONSHIPS = ["Owner", "Manager", "Franchisee", "Other staff member"];

interface Props {
  fhrsId: number;
  businessName: string;
}

type FormState = { status: "idle" } | { status: "submitting" } | { status: "success" } | { status: "error"; message: string };

// Submits to the first mutation route in the app (POST /api/establishments/[id]/claim) —
// see that route's own comments for why review is manual rather than automated. This form
// only collects a *contact request*; the actual business content (description, photos) is
// added later by the site operator once the claim is approved and the owner has sent their
// copy — see BusinessProfile in schema.prisma.
export function ClaimForm({ fhrsId, businessName }: Props) {
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const formData = new FormData(event.currentTarget);
    const body = {
      claimantName: String(formData.get("claimantName") ?? ""),
      claimantEmail: String(formData.get("claimantEmail") ?? ""),
      claimantPhone: String(formData.get("claimantPhone") ?? ""),
      relationship: String(formData.get("relationship") ?? ""),
      message: String(formData.get("message") ?? ""),
      website: String(formData.get("website") ?? ""), // honeypot — see the API route
    };

    try {
      await postJson(`/api/establishments/${fhrsId}/claim`, body);
      setState({ status: "success" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof ApiError ? err.message : "Something went wrong submitting your claim. Please try again.",
      });
    }
  }

  if (state.status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-semibold text-green-800">Claim submitted</p>
        <p className="mt-2 text-sm text-green-700">
          Thanks — we&rsquo;ll review your claim for {businessName} and get in touch at the email address you provided.
        </p>
        <Link
          href={establishmentPath(fhrsId, businessName)}
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          Back to the listing
        </Link>
      </div>
    );
  }

  const isSubmitting = state.status === "submitting";

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {state.status === "error" && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="claimantName" className="text-sm font-medium text-gray-700">
          Your name
        </label>
        <input
          id="claimantName"
          name="claimantName"
          type="text"
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="claimantEmail" className="text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="claimantEmail"
          name="claimantEmail"
          type="email"
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="claimantPhone" className="text-sm font-medium text-gray-700">
          Phone <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="claimantPhone"
          name="claimantPhone"
          type="tel"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="relationship" className="text-sm font-medium text-gray-700">
          Your connection to this business
        </label>
        <select
          id="relationship"
          name="relationship"
          required
          defaultValue=""
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        >
          <option value="" disabled>
            Select one
          </option>
          {RELATIONSHIPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm font-medium text-gray-700">
          Anything else? <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      {/* Honeypot — hidden from real visitors via CSS (not display:none/hidden, which some
          bots skip filling), so it stays in the tab order for nobody but crawlers. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}
