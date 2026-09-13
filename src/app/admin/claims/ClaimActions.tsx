"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/api-client";

export function ClaimActions({ claimId }: { claimId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function review(status: "approved" | "rejected") {
    setPending(true);
    try {
      await postJson(`/api/admin/claims/${claimId}/review`, { status });
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => review("approved")}
        className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => review("rejected")}
        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
