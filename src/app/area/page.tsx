import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/jsonld";
import { LOCAL_AUTHORITIES, type LocalAuthority } from "@/lib/local-authorities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "Food Hygiene Ratings by Area";
const DESCRIPTION =
  "Browse UK food hygiene ratings by local authority area — find the best-rated restaurants, takeaways, pubs and food businesses near you.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/area` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/area` },
};

// The list itself is static build-time data (see src/lib/local-authorities.ts), but keep
// this consistent with the other /area pages rather than fully static, in case that ever
// changes.
export const revalidate = 3600;

function groupByFirstLetter(authorities: LocalAuthority[]): Map<string, LocalAuthority[]> {
  const grouped = new Map<string, LocalAuthority[]>();
  for (const authority of authorities) {
    const letter = authority.name[0]?.toUpperCase() ?? "#";
    if (!grouped.has(letter)) grouped.set(letter, []);
    grouped.get(letter)!.push(authority);
  }
  return grouped;
}

export default function AreaIndexPage() {
  const grouped = groupByFirstLetter(LOCAL_AUTHORITIES);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "All areas", url: `${SITE_URL}/area` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Food Hygiene Ratings by Area</h1>
      <p className="mt-2 text-sm text-gray-600">
        {LOCAL_AUTHORITIES.length} UK local authorities — pick one to see the best-rated food businesses there.
      </p>

      <div className="mt-8 columns-2 gap-8 sm:columns-3 lg:columns-4">
        {[...grouped.entries()].map(([letter, authorities]) => (
          <div key={letter} className="mb-6 break-inside-avoid">
            <h2 className="text-sm font-bold text-indigo-600">{letter}</h2>
            <ul className="mt-1 space-y-1">
              {authorities.map((authority) => (
                <li key={authority.slug}>
                  <Link
                    href={`/area/${authority.slug}`}
                    className="text-sm text-gray-700 transition-colors hover:text-indigo-600 hover:underline"
                  >
                    {authority.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
