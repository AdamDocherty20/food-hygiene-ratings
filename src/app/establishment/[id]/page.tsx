import type { Metadata } from "next";
import { EstablishmentDetailClient } from "./EstablishmentDetailClient";
import { prisma } from "@/lib/prisma";
import { parseFhrsIdParam } from "@/lib/slug";

const SITE_NAME = "Should I Eat Here";
const FALLBACK_TITLE = `Establishment Hygiene Rating | ${SITE_NAME}`;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fhrsId = Number(parseFhrsIdParam(id));

  if (!Number.isInteger(fhrsId)) {
    return { title: FALLBACK_TITLE };
  }

  const establishment = await prisma.establishment.findFirst({
    where: { fhrsId, isActive: true },
    select: { businessName: true },
  });

  if (!establishment) {
    return { title: FALLBACK_TITLE };
  }

  return { title: `${establishment.businessName} Hygiene Rating | ${SITE_NAME}` };
}

export default function EstablishmentDetailPage() {
  return <EstablishmentDetailClient />;
}
