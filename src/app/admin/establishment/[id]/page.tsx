import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileForm } from "./ProfileForm";
import { prisma } from "@/lib/prisma";
import { establishmentPath } from "@/lib/slug";

export const metadata: Metadata = { title: "Edit listing | Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminEstablishmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fhrsId = Number(id);
  if (!Number.isInteger(fhrsId)) notFound();

  const establishment = await prisma.establishment.findFirst({
    where: { fhrsId, isActive: true },
    select: { fhrsId: true, businessName: true },
  });
  if (!establishment) notFound();

  const profile = await prisma.businessProfile.findUnique({ where: { fhrsId } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin/claims" className="text-sm font-medium text-indigo-600 hover:underline">
        ← Back to claims
      </Link>
      <h1 className="mt-4 text-xl font-bold text-gray-900">{establishment.businessName}</h1>
      <Link
        href={establishmentPath(establishment.fhrsId, establishment.businessName)}
        target="_blank"
        className="text-sm text-gray-500 hover:text-indigo-600"
      >
        View live listing ↗
      </Link>

      <div className="mt-6">
        <ProfileForm
          fhrsId={establishment.fhrsId}
          initial={{
            description: profile?.description ?? "",
            website: profile?.website ?? "",
            phone: profile?.phone ?? "",
            photoUrls: profile?.photoUrls ?? [],
          }}
        />
      </div>
    </div>
  );
}
