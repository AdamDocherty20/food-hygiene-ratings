import type { Metadata } from "next";
import Link from "next/link";
import { ClaimActions } from "./ClaimActions";
import { prisma } from "@/lib/prisma";
import { establishmentPath } from "@/lib/slug";

export const metadata: Metadata = { title: "Claims | Admin", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic"; // always fresh — this is a small internal review queue, not a cached public page

export default async function AdminClaimsPage() {
  const claims = await prisma.businessClaim.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const fhrsIds = [...new Set(claims.map((c) => c.fhrsId))];
  const establishments = await prisma.establishment.findMany({
    where: { fhrsId: { in: fhrsIds } },
    select: { fhrsId: true, businessName: true },
  });
  const nameByFhrsId = new Map(establishments.map((e) => [e.fhrsId, e.businessName]));

  const pending = claims.filter((c) => c.status === "pending");
  const reviewed = claims.filter((c) => c.status !== "pending");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Business claims</h1>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="text-sm text-gray-500 hover:text-indigo-600">
            Log out
          </button>
        </form>
      </div>

      <Link href="/admin/blog" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
        Blog posts →
      </Link>

      <h2 className="mt-8 text-sm font-semibold tracking-wide text-gray-500 uppercase">Pending ({pending.length})</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {pending.length === 0 && <p className="text-sm text-gray-500">Nothing waiting on review.</p>}
        {pending.map((claim) => (
          <li key={claim.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href={establishmentPath(claim.fhrsId, nameByFhrsId.get(claim.fhrsId) ?? "")}
                  className="font-medium text-indigo-600 hover:underline"
                  target="_blank"
                >
                  {nameByFhrsId.get(claim.fhrsId) ?? `Establishment ${claim.fhrsId}`}
                </Link>
                <p className="mt-1 text-sm text-gray-700">
                  {claim.claimantName} · {claim.relationship} · {claim.claimantEmail}
                  {claim.claimantPhone ? ` · ${claim.claimantPhone}` : ""}
                </p>
                {claim.message && <p className="mt-1 text-sm text-gray-500">&ldquo;{claim.message}&rdquo;</p>}
                <p className="mt-1 text-xs text-gray-400">{claim.createdAt.toLocaleString("en-GB")}</p>
              </div>
              <ClaimActions claimId={claim.id} />
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-sm font-semibold tracking-wide text-gray-500 uppercase">Reviewed</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {reviewed.map((claim) => (
          <li key={claim.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-sm">
            <span>
              {nameByFhrsId.get(claim.fhrsId) ?? `Establishment ${claim.fhrsId}`} — {claim.claimantEmail}
            </span>
            <div className="flex items-center gap-3">
              <span className={claim.status === "approved" ? "text-green-700" : "text-gray-500"}>{claim.status}</span>
              {claim.status === "approved" && (
                <Link href={`/admin/establishment/${claim.fhrsId}`} className="text-indigo-600 hover:underline">
                  Edit listing
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
