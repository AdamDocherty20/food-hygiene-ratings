import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimForm } from "./ClaimForm";
import { prisma } from "@/lib/prisma";
import { establishmentPath, parseFhrsIdParam } from "@/lib/slug";

const SITE_NAME = "Should I Eat Here";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));
  if (!Number.isInteger(fhrsId)) return { title: `Claim your business | ${SITE_NAME}` };

  const establishment = await prisma.establishment.findFirst({
    where: { fhrsId, isActive: true },
    select: { businessName: true },
  });

  return {
    title: establishment ? `Claim ${establishment.businessName} | ${SITE_NAME}` : `Claim your business | ${SITE_NAME}`,
    robots: { index: false }, // a contact form has nothing worth ranking, and shouldn't compete with the establishment page itself
  };
}

// Deliberately a minimal lookup (just businessName, for the heading/confirmation copy),
// not the full getEstablishmentDetailData used by the parent page — this page doesn't
// need ratings, history, or any of that to render a contact form.
export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));
  if (!Number.isInteger(fhrsId)) notFound();

  const establishment = await prisma.establishment.findFirst({
    where: { fhrsId, isActive: true },
    select: { fhrsId: true, businessName: true },
  });
  if (!establishment) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link
        href={establishmentPath(establishment.fhrsId, establishment.businessName)}
        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to {establishment.businessName}
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">Claim this business</h1>
      <p className="mt-2 text-sm text-gray-600">
        Are you the owner or manager of <strong>{establishment.businessName}</strong>? Tell us a bit about yourself and
        we&rsquo;ll review your claim — once approved, we can add photos and details to your listing.
      </p>

      <div className="mt-6">
        <ClaimForm fhrsId={establishment.fhrsId} businessName={establishment.businessName} />
      </div>
    </div>
  );
}
